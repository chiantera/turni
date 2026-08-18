#!/usr/bin/env python3
"""Legge un prospetto turni del coordinatore e ne ricava copertura, ore e assenze.

    ./scripts/leggi-prospetto.py "turni_dati/Turni Stradora AGOSTO 2026.pdf"
    ./scripts/leggi-prospetto.py "turni_dati/...pdf" --sql   # INSERT per absences

Serve a una cosa sola: sostituire una *deduzione* con una *misura*. La copertura
caricata a mano ad agosto 2026 derivava dalla legenda — «ogni sigla e' un ruolo,
quindi una persona per sigla ogni giorno» — e leggendo un mese vero due sigle su
sedici si sono rivelate sbagliate: `N` non compare mai, `PRG` compare 15 volte in
31 giorni invece di 31. Erano 99 h/settimana di fabbisogno inventato.

Dipendenze: `pdftotext` (poppler-utils) e la sola libreria standard. Non gira in
CI e non tocca il database: stampa, e con --sql genera SQL da rivedere a mano.

## Perche' le coordinate e non `pdftotext -layout`

Il PDF nasce da Excel: ogni giorno e' una colonna a x fissa. L'allineamento
testuale di `-layout` e' leggibile a occhio ma perde le celle vuote, e una cella
vuota qui e' un dato (DIMAS FERNANDES ne ha sei). Si mappa quindi ogni parola
alla colonna piu' vicina, ricavando le colonne dalla riga «1 2 3 ... 31».

## La struttura del prospetto

Ogni lavoratore occupa due righe: sopra i codici di turno, sotto il cognome con
le annotazioni (bellezza, piscina, EQ, GSS, F5...). Un cognome scritto su due
righe non ha una griglia propria e si accoda al precedente.
"""

import json
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

NS = "{http://www.w3.org/1999/xhtml}"
COL_NOME_MAX = 145.0  # a sinistra di questa x c'e' il cognome, non un giorno
Y_PRIMA_RIGA = 100.0  # sopra: intestazioni (GIORNI, GIORNO SETTIMANA, SE ERRORE)
Y_LEGENDA = 770.0     # sotto: la legenda in fondo al foglio
TOLLERANZA_RIGA = 3.0
TOLLERANZA_COLONNA = 7.0

# Durate dagli ORARI della legenda, non dalla colonna «Durata»: per Mb e Md le due
# fonti si contraddicono (7:00->14:00 dichiarato 7,5 h) e l'ora di fine e' quella
# che governa i riposi minimi nel solver. Rispecchia `shift_types` sul database:
# se le due divergono, quella autorevole e' il database.
DURATA_MIN = {
    "MA": 450, "MB": 420, "MC": 450, "MD": 420, "ME": 390, "MF": 330,
    "PA": 420, "PB": 450, "PC": 420, "PD": 420, "PE": 390, "PF": 300,
    "N1": 660, "N2": 690, "PRG": 360, "MAP": 270, "AP": 360, "N": 660,
}
# Sigle a copertura fissa: una persona al giorno. PRG resta fuori perche' e'
# saltuario, ed e' proprio l'errore che questo script serve a non ripetere.
COPERTURA_FISSA = ["MA", "MB", "MC", "MD", "ME", "MF",
                   "PA", "PB", "PC", "PD", "PE", "PF", "N1", "N2"]
# Non sono turni: SN e' la coda della notte precedente (ore gia' contate in
# N1/N2), RD e' reperibilita' diurna (legenda: «da 30 min prima a 30 min dopo
# ogni turno»), R e' riposo.
NON_TURNI = {"SN", "RD", "R"}
ASSENZE = {"X": "ferie", "MAL": "malattia"}
ORE_MESE_FULL_TIME = 151.92  # dall'intestazione del prospetto


def formazione(codice):
    return codice.startswith("F") and codice[1:].isdigit()


def parole(pdf):
    """Estrae le parole del PDF con le loro coordinate."""
    with tempfile.NamedTemporaryFile(suffix=".xml") as tmp:
        subprocess.run(["pdftotext", "-bbox-layout", pdf, tmp.name], check=True)
        albero = ET.parse(tmp.name)
    for p in albero.iter(NS + "word"):
        x0, y0, x1, y1 = (float(p.get(k)) for k in ("xMin", "yMin", "xMax", "yMax"))
        yield {"t": (p.text or "").strip(), "xc": (x0 + x1) / 2, "yc": (y0 + y1) / 2}


def righe(pdf):
    """Raggruppa le parole in righe per coordinata verticale."""
    ps = sorted(parole(pdf), key=lambda p: (p["yc"], p["xc"]))
    out = []
    for p in ps:
        if out and abs(p["yc"] - out[-1]["yc"]) < TOLLERANZA_RIGA:
            out[-1]["parole"].append(p)
        else:
            out.append({"yc": p["yc"], "parole": [p]})
    return out


def leggi(pdf):
    """Restituisce [{nome, turni: {giorno: [codici]}, note: {giorno: [testi]}}]."""
    rs = righe(pdf)

    colonne = None
    for r in rs:
        n = [p for p in r["parole"] if p["t"].isdigit() and p["xc"] > COL_NOME_MAX]
        if len(n) == 31 and [int(p["t"]) for p in n] == list(range(1, 32)):
            colonne = [p["xc"] for p in n]
            break
    if not colonne:
        sys.exit("Colonne dei giorni non trovate: il prospetto ha un'altra forma.")

    def giorno(xc):
        i = min(range(31), key=lambda k: abs(colonne[k] - xc))
        return i + 1 if abs(colonne[i] - xc) < TOLLERANZA_COLONNA else None

    def per_giorno(ps):
        d = defaultdict(list)
        for p in ps:
            if p["xc"] >= COL_NOME_MAX and (g := giorno(p["xc"])):
                d[g].append(p["t"])
        return dict(d)

    lavoratori, griglia = [], None
    for r in rs:
        if not (Y_PRIMA_RIGA < r["yc"] < Y_LEGENDA):
            continue
        nome = [p for p in r["parole"] if p["xc"] < COL_NOME_MAX]
        if not nome:
            griglia = r  # riga di codici, in attesa del cognome sotto
            continue
        etichetta = " ".join(p["t"] for p in nome)
        if griglia is None and lavoratori:
            # Cognome su due righe: si accoda al lavoratore precedente.
            lavoratori[-1]["nome"] += " " + etichetta
            for g, ts in per_giorno(r["parole"]).items():
                lavoratori[-1]["note"].setdefault(g, []).extend(ts)
            continue
        lavoratori.append({
            "nome": etichetta,
            "turni": per_giorno(griglia["parole"]) if griglia else {},
            "note": per_giorno(r["parole"]),
        })
        griglia = None
    return lavoratori


def rapporto(lavoratori):
    codici = Counter(t for l in lavoratori for ts in l["turni"].values() for t in ts)
    ignoti = sorted(c for c in codici
                    if c not in DURATA_MIN and c not in NON_TURNI
                    and c not in ASSENZE and not formazione(c))
    if ignoti:
        print("⚠  CODICI SCONOSCIUTI — le ore che seguono NON li contano:")
        for c in ignoti:
            print(f"     {c!r} × {codici[c]}")
        print()

    per_giorno = defaultdict(Counter)
    for l in lavoratori:
        for g, ts in l["turni"].items():
            per_giorno[int(g)].update(ts)

    print("COPERTURA — deviazioni dalla regola «una persona per sigla al giorno»")
    deviazioni = 0
    for sigla in COPERTURA_FISSA:
        fuori = [(g, per_giorno[g][sigla]) for g in range(1, 32)
                 if per_giorno[g][sigla] != 1]
        deviazioni += len(fuori)
        if fuori:
            print(f"  {sigla:4} " + ", ".join(f"gg {g}→{n}" for g, n in fuori))
    celle = 31 * len(COPERTURA_FISSA)
    print(f"  {celle - deviazioni}/{celle} celle conformi "
          f"({(celle - deviazioni) / celle * 100:.1f}%)")

    fissa_h = sum(DURATA_MIN[s] for s in COPERTURA_FISSA) / 60
    print(f"\n  copertura fissa: {fissa_h:.1f} h/giorno → {fissa_h * 7:.1f} h/settimana")
    for sigla in sorted(set(DURATA_MIN) - set(COPERTURA_FISSA)):
        if codici[sigla]:
            print(f"  {sigla}: {codici[sigla]} turni in 31 giorni "
                  f"({codici[sigla] / 31:.2f}/giorno) → "
                  f"{DURATA_MIN[sigla] * codici[sigla] / 60 * 7 / 31:.1f} h/settimana")

    print(f"\n{'ORE PER PERSONA':22} {'ore':>7} {'%FT':>5} {'assenti':>8} "
          f"{'atteso':>7} {'scarto':>7}")
    totale = atteso_totale = 0.0
    for l in lavoratori:
        c = Counter(t for ts in l["turni"].values() for t in ts)
        ore = sum(DURATA_MIN[k] * v for k, v in c.items() if k in DURATA_MIN) / 60
        assenti = sum(v for k, v in c.items() if k in ASSENZE)
        if not ore and not assenti:
            continue  # tirocinanti e righe senza griglia
        atteso = ORE_MESE_FULL_TIME * (31 - assenti) / 31
        totale, atteso_totale = totale + ore, atteso_totale + atteso
        print(f"{l['nome']:22} {ore:7.1f} {ore / ORE_MESE_FULL_TIME * 100:4.0f}% "
              f"{assenti:8} {atteso:7.1f} {ore - atteso:+7.1f}")
    print(f"{'TOTALE':22} {totale:7.1f} {'':5} {'':8} {atteso_totale:7.1f} "
          f"{totale - atteso_totale:+7.1f}  "
          f"({(totale / atteso_totale - 1) * 100:+.1f}% sul contratto pieno)")


def blocchi(giorni):
    out = []
    for g in sorted(giorni):
        if out and g == out[-1][1] + 1:
            out[-1][1] = g
        else:
            out.append([g, g])
    return out


def sql(lavoratori, mese):
    """INSERT per `absences`. Da rivedere: le grafie dei cognomi non sono verificate."""
    valori = []
    for l in lavoratori:
        per_tipo = defaultdict(list)
        for g, ts in l["turni"].items():
            for t in ts:
                if t in ASSENZE:
                    per_tipo[ASSENZE[t]].append(int(g))
                elif formazione(t):
                    per_tipo["formazione"].append(int(g))
        for tipo, giorni in per_tipo.items():
            for a, b in blocchi(giorni):
                valori.append(f"  ('{l['nome']}', date '{mese}-{a:02}', "
                              f"date '{mese}-{b:02}', '{tipo}')")
    print("-- Rivedere prima di eseguire: i cognomi devono combaciare con `workers`.")
    print("insert into absences (worker_id, dal, al, tipo, giornata_intera)")
    print("select w.id, v.dal, v.al, v.tipo::tipo_assenza, true")
    print("from (values\n" + ",\n".join(valori))
    print(") as v(cognome, dal, al, tipo)")
    print("join workers w on w.cognome = v.cognome;")


if __name__ == "__main__":
    argomenti = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not argomenti:
        sys.exit(__doc__.strip().splitlines()[2].strip())
    dati = leggi(argomenti[0])
    print(f"{len(dati)} lavoratori letti da {argomenti[0]}\n")
    if "--sql" in sys.argv:
        sql(dati, argomenti[1] if len(argomenti) > 1 else "2026-08")
    elif "--json" in sys.argv:
        json.dump(dati, sys.stdout, ensure_ascii=False, indent=1)
    else:
        rapporto(dati)
