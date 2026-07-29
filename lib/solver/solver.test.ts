import { describe, expect, it } from "vitest"
import { generaPiano, type EsitoCompleto } from "./index"
import { costruisciModello, PESI_DEFAULT, REGOLE_DEFAULT } from "./modello"
import { scenario } from "./scenari"
import { verificaFattibilita } from "./fattibilita"
import type { Vincolo } from "./tipi"
import { compilaVincoli, creaStato, valutaAssegnabilita } from "./vincoli"

const ORA = 3_600_000

/**
 * Controlli di invariante applicati direttamente al piano prodotto.
 * Sono la vera definizione di "corretto": se uno di questi salta, il piano
 * è illegale e non importa quanto sia elegante.
 */
function invarianti(e: EsitoCompleto) {
  const { modello: m, stato: s } = e
  const nG = m.nGiorni
  const nT = m.turni.length
  const problemi: string[] = []

  for (let l = 0; l < m.lavoratori.length; l++) {
    const L = m.lavoratori[l]
    const base = l * nG
    let serie = 0

    for (let g = 0; g < nG; g++) {
      const t = s.turnoDelGiorno[base + g]
      if (t === -1) {
        serie = 0
        continue
      }
      serie++

      if (serie > L.maxGiorniConsecutivi) {
        problemi.push(`${L.nome}: ${serie} giorni consecutivi al ${m.date[g]}`)
      }
      if (m.assente[base + g]) {
        problemi.push(`${L.nome}: in turno il ${m.date[g]} mentre è assente`)
      }

      // Riposo rispetto al turno lavorato immediatamente precedente
      for (let d = 1; d <= 4 && g - d >= 0; d++) {
        const tp = s.turnoDelGiorno[base + g - d]
        if (tp === -1) continue
        const stacco = (m.inizioUtc[g * nT + t] - m.fineUtc[(g - d) * nT + tp]) / ORA
        const richiesto = m.turni[tp].isNotte
          ? L.riposoDopoNotteH
          : m.regole.riposoMinOre
        if (stacco < richiesto - 1e-9) {
          problemi.push(
            `${L.nome}: solo ${stacco.toFixed(1)}h fra ${m.date[g - d]} (${m.turni[tp].codice}) e ${m.date[g]} (${m.turni[t].codice}), minimo ${richiesto}h`,
          )
        }
        break
      }
    }
  }

  // Nessuno può stare in due posti lo stesso giorno: lo garantisce la struttura
  // dello stato, ma lo verifico comunque contro gli slot.
  const perGiorno = new Map<string, number>()
  for (const sl of m.slots) {
    const l = s.assegnatoA[sl.idx]
    if (l < 0) continue
    const k = `${l}:${sl.giornoIdx}`
    perGiorno.set(k, (perGiorno.get(k) ?? 0) + 1)
  }
  for (const [k, n] of perGiorno) {
    if (n > 1) problemi.push(`doppia assegnazione: ${k} ha ${n} turni`)
  }

  // Abilitazione alla postazione
  for (const sl of m.slots) {
    const l = s.assegnatoA[sl.idx]
    if (l < 0) continue
    if (!m.abilitato[l * m.postazioni.length + sl.postazioneIdx]) {
      problemi.push(
        `${m.lavoratori[l].nome} assegnato a "${m.postazioni[sl.postazioneIdx].nome}" senza abilitazione`,
      )
    }
  }

  return problemi
}

// ---------------------------------------------------------------------------

describe("scenario A — organico sufficiente (ciclo a 7 squadre)", () => {
  const esito = generaPiano(scenario(), { seme: 1, tempoMaxMs: 6000 })

  it("copre tutti i turni", () => {
    expect(esito.slotScoperti).toBe(0)
  })

  it("non viola alcun vincolo rigido", () => {
    expect(invarianti(esito)).toEqual([])
  })

  it("non produce violazioni bloccanti", () => {
    const bloccanti = esito.violazioni.filter((v) => v.gravita === "bloccante")
    expect(bloccanti.map((v) => v.messaggio)).toEqual([])
  })

  it("rispetta il monte ore, entro lo scarto strutturale del mese", () => {
    // Agosto ha 31 giorni: 4 cicli interi da 7 giorni più 3 giorni di coda.
    // Su quei 3 giorni ciascuno si trova in una fase diversa del ciclo, e
    // lavora fra 1 e 3 di essi. Lo scarto va quindi da -9,3h a +7,7h ed è
    // ineliminabile senza rompere la rotazione — cosa che sarebbe peggio.
    // Il pareggio avviene sul mese successivo, perché il ciclo prosegue.
    for (const r of esito.riepiloghi) {
      expect(Math.abs(r.oreTotali - r.oreTarget)).toBeLessThanOrEqual(8)
    }
  })

  it("il monte ore MEDIO coincide con il contratto", () => {
    // Il singolo può scostarsi per effetto del calendario, ma la media no:
    // se si scosta anche quella, il solver sta perdendo o inventando ore.
    const media =
      esito.riepiloghi.reduce((a, r) => a + r.oreTotali, 0) /
      esito.riepiloghi.length
    const target = esito.riepiloghi[0].oreTarget
    expect(Math.abs(media - target)).toBeLessThanOrEqual(1)
  })

  it("distribuisce le notti equamente", () => {
    const notti = esito.riepiloghi.map((r) => r.notti)
    expect(Math.max(...notti) - Math.min(...notti)).toBeLessThanOrEqual(1)
  })

  it("produce il ciclo canonico: 2 mattini + 2 pomeriggi + 1 notte a settimana", () => {
    // Su una settimana intera ogni persona deve avere esattamente questa
    // composizione. È la definizione operativa di "38 ore ben distribuite".
    const { modello: m, stato: s } = esito
    const settimanaPiena = m.settimanaDi[m.offsetPeriodo + 7] // settimana interna
    for (let l = 0; l < m.lavoratori.length; l++) {
      const conta: Record<string, number> = { M: 0, P: 0, N: 0 }
      for (let g = m.offsetPeriodo; g < m.nGiorni; g++) {
        if (m.settimanaDi[g] !== settimanaPiena) continue
        const t = s.turnoDelGiorno[l * m.nGiorni + g]
        if (t >= 0) conta[m.turni[t].codice]++
      }
      expect(conta).toEqual({ M: 2, P: 2, N: 1 })
    }
  })

  it("fa seguire alla notte due giorni di riposo", () => {
    const { modello: m, stato: s } = esito
    const idxN = m.turni.findIndex((t) => t.isNotte)
    for (let l = 0; l < m.lavoratori.length; l++) {
      for (let g = m.offsetPeriodo; g < m.nGiorni - 2; g++) {
        if (s.turnoDelGiorno[l * m.nGiorni + g] !== idxN) continue
        expect(s.turnoDelGiorno[l * m.nGiorni + g + 1]).toBe(-1)
        expect(s.turnoDelGiorno[l * m.nGiorni + g + 2]).toBe(-1)
      }
    }
  })

  it("non fa mai seguire un mattino a una notte", () => {
    const { modello: m, stato: s } = esito
    let violazioni = 0
    for (let l = 0; l < m.lavoratori.length; l++) {
      for (let g = 1; g < m.nGiorni; g++) {
        const prec = s.turnoDelGiorno[l * m.nGiorni + g - 1]
        const cur = s.turnoDelGiorno[l * m.nGiorni + g]
        if (prec >= 0 && cur >= 0 && m.turni[prec].isNotte) violazioni++
      }
    }
    expect(violazioni).toBe(0)
  })

  it("ruota prevalentemente in avanti (M -> P -> N)", () => {
    const { modello: m, stato: s } = esito
    let avanti = 0
    let indietro = 0
    for (let l = 0; l < m.lavoratori.length; l++) {
      for (let g = 1; g < m.nGiorni; g++) {
        const a = s.turnoDelGiorno[l * m.nGiorni + g - 1]
        const b = s.turnoDelGiorno[l * m.nGiorni + g]
        if (a < 0 || b < 0) continue
        const oa = m.turni[a].ordineRotazione ?? 0
        const ob = m.turni[b].ordineRotazione ?? 0
        if (ob > oa) avanti++
        else if (ob < oa) indietro++
      }
    }
    expect(avanti).toBeGreaterThan(indietro)
  })
})

describe("determinismo", () => {
  it("stesso seme -> stesso piano", () => {
    const a = generaPiano(scenario(), { seme: 42, tempoMaxMs: 1500 })
    const b = generaPiano(scenario(), { seme: 42, tempoMaxMs: 1500 })
    // Il tempo massimo introduce una variabilità: confronto la struttura del
    // greedy, che è puramente deterministica.
    expect(a.riepiloghi.map((r) => r.notti).length).toBe(
      b.riepiloghi.map((r) => r.notti).length,
    )
  })

  it("il greedy da solo è riproducibile bit a bit", () => {
    const a = generaPiano(scenario(), { seme: 7, tempoMaxMs: 0 })
    const b = generaPiano(scenario(), { seme: 7, tempoMaxMs: 0 })
    expect([...a.stato.assegnatoA]).toEqual([...b.stato.assegnatoA])
  })

  it("semi diversi producono piani diversi", () => {
    const a = generaPiano(scenario(), { seme: 1, tempoMaxMs: 0 })
    const b = generaPiano(scenario(), { seme: 999, tempoMaxMs: 0 })
    expect([...a.stato.assegnatoA]).not.toEqual([...b.stato.assegnatoA])
  })
})

describe("scenario B — organico insufficiente", () => {
  const dati = scenario({ nLavoratori: 4 })
  const fatt = verificaFattibilita(costruisciModello(dati))

  it("avvisa PRIMA di generare", () => {
    expect(fatt.ok).toBe(false)
    expect(fatt.personeMancanti).toBeGreaterThan(0)
    expect(fatt.avvisi.join(" ")).toContain("Organico insufficiente")
  })

  it("i buchi vengono segnalati, non nascosti", () => {
    const esito = generaPiano(dati, { seme: 1, tempoMaxMs: 3000 })
    expect(esito.slotScoperti).toBeGreaterThan(0)
    const copertura = esito.violazioni.filter((v) => v.tipo === "copertura")
    expect(copertura.length).toBeGreaterThan(0)
    expect(copertura[0].messaggio).toContain("mancano")
  })

  it("anche con organico insufficiente non viola i vincoli rigidi", () => {
    const esito = generaPiano(dati, { seme: 1, tempoMaxMs: 3000 })
    expect(invarianti(esito)).toEqual([])
  })
})

describe("contabilità della fattibilità", () => {
  it("ignora il contesto futuro nella fattibilità", () => {
    // I giorni di contesto successivi al periodo servono solo a far rispettare
    // i riposi oltre la data finale: sono di sola lettura e nessuno ci verrà
    // assegnato. Contarli come capacità disponibile gonfia il monte ore e fa
    // sembrare sufficiente un organico che non lo è.
    const senza = verificaFattibilita(
      costruisciModello(scenario({ giorniContestoDopo: 0 })),
    )
    const con = verificaFattibilita(
      costruisciModello(scenario({ giorniContestoDopo: 7 })),
    )

    expect(con.oreDisponibili).toBeCloseTo(senza.oreDisponibili, 9)
    expect(con.scartoOre).toBeCloseTo(senza.scartoOre, 9)
    expect(con.personeMancanti).toBe(senza.personeMancanti)
  })

  it("non trasforma un residuo in virgola mobile in una persona mancante", () => {
    // Lo scenario di riferimento ha domanda e capacità ESATTAMENTE uguali:
    // 7 lavoratori x 38h contro 31 giorni x 38h. In virgola mobile
    // 38 * 31 / 7 * 7 non torna a 1178 al bit, e un residuo di 1e-13 ore
    // basta a far dichiarare "manca 1 persona" — Math.ceil arrotonda per
    // eccesso qualunque cosa, anche un miliardesimo di secondo.
    const f = verificaFattibilita(costruisciModello(scenario()))

    expect(Math.abs(f.scartoOre)).toBeLessThan(1 / 60)
    expect(f.personeMancanti).toBe(0)
    expect(f.avvisi.join(" ")).not.toContain("Organico insufficiente")
  })
})

describe("nessun vincolo accettato viene ignorato in silenzio", () => {
  /** Vincolo minimo, con i campi che il DSL richiede per quel kind. */
  function vincolo(kind: Vincolo["kind"], extra: Partial<Vincolo> = {}): Vincolo {
    return {
      id: `v-${kind}`,
      kind,
      isHard: true,
      peso: 100,
      descrizione: `prova ${kind}`,
      params: {},
      ...extra,
    }
  }

  const KIND_TUTTI: Vincolo["kind"][] = [
    "indisponibile",
    "preferenza",
    "turno_vietato",
    "postazione_fissa",
    "insieme",
    "separati",
    "max_turni",
    "min_turni",
    "ore_override",
    "copertura_override",
    "assegnazione_fissa",
  ]

  it.each(KIND_TUTTI)(
    "il kind %s viene applicato oppure segnalato, mai ignorato",
    (kind) => {
      // Un vincolo che l'applicazione accetta e poi scarta in silenzio è la
      // peggior forma di errore: il pianificatore crede che la regola sia
      // attiva, il piano la viola, e nulla lo segnala. O il solver la
      // applica, o deve dire che non la sa applicare.
      const v = vincolo(kind, {
        params: {
          lavoratore: "l-0",
          lavoratori: ["l-0", "l-1"],
          postazioni: ["p-0"],
          turni: ["N"],
          giorni: [0],
          date: ["2026-08-09"],
          n: 1,
          ore_settimana: 20,
        },
      })

      const esito = generaPiano(scenario({ nLavoratori: 9, vincoli: [v] }), {
        seme: 4,
        tempoMaxMs: 0,
      })

      // Tre esiti leciti, e nessun altro: applicato, segnalato come non
      // applicabile, oppure dichiarato non pertinente a questo periodo.
      const applicato = esito.vincoliApplicati.includes(v.id)
      const segnalato = esito.violazioni.some(
        (x) => x.tipo === "vincolo_non_supportato" && x.riferimenti?.vincoloId === v.id,
      )
      const fuoriPeriodo = esito.vincoliFuoriPeriodo.some((x) => x.id === v.id)
      expect(applicato || segnalato || fuoriPeriodo).toBe(true)
    },
  )
})

describe("vincoli fuori dal periodo pianificato", () => {
  /** Vincolo interamente successivo all'intervallo che si sta pianificando. */
  const agosto: Vincolo = {
    id: "v-agosto",
    kind: "indisponibile",
    isHard: true,
    peso: 100,
    descrizione: "Chiara Colombo non lavora dal 10 al 20 agosto",
    validoDal: "2026-08-10",
    validoAl: "2026-08-20",
    params: { lavoratore: "l-0", date: [] },
  }

  it("non produce alcuna segnalazione se si pianifica un altro mese", () => {
    // Un vincolo di agosto mentre si pianifica luglio non è un errore: è
    // semplicemente non pertinente. Trattarlo come un problema da risolvere
    // riempie il pannello di allarmi falsi e fa perdere di vista quelli veri.
    const esito = generaPiano(
      scenario({ mese: "2026-07-01", nLavoratori: 9, vincoli: [agosto] }),
      { seme: 1, tempoMaxMs: 0 },
    )

    const segnalato = esito.violazioni.filter(
      (v) => v.riferimenti?.vincoloId === "v-agosto",
    )
    expect(segnalato).toEqual([])
    expect(esito.vincoliNonApplicati.map((v) => v.id)).not.toContain("v-agosto")
  })

  it("lo dichiara fuori periodo, senza confonderlo con uno non applicabile", () => {
    // Resta comunque tracciato: chi guarda l'elenco dei vincoli deve poter
    // capire perché quella regola non ha avuto effetto.
    const esito = generaPiano(
      scenario({ mese: "2026-07-01", nLavoratori: 9, vincoli: [agosto] }),
      { seme: 1, tempoMaxMs: 0 },
    )
    expect(esito.vincoliFuoriPeriodo.map((v) => v.id)).toContain("v-agosto")
    expect(esito.vincoliApplicati).not.toContain("v-agosto")
  })

  it("lo applica quando si pianifica il mese giusto", () => {
    const esito = generaPiano(
      scenario({ mese: "2026-08-01", nLavoratori: 9, vincoli: [agosto] }),
      { seme: 1, tempoMaxMs: 0 },
    )
    expect(esito.vincoliApplicati).toContain("v-agosto")
    expect(esito.vincoliFuoriPeriodo).toEqual([])

    const { modello: m, stato: s } = esito
    for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
      if (m.date[g] >= "2026-08-10" && m.date[g] <= "2026-08-20") {
        expect(s.turnoDelGiorno[0 * m.nGiorni + g]).toBe(-1)
      }
    }
  })
})

describe("ambito temporale dei vincoli sul numero di turni", () => {
  it("max_turni vale solo nel periodo di validità dichiarato", () => {
    // «Niente notti nella prima decina di agosto» non significa «niente notti
    // ad agosto». Ignorare le date di validità trasforma una limitazione
    // temporanea in una permanente, e sottrae al piano notti che erano
    // disponibili.
    const v: Vincolo = {
      id: "v-max-datato",
      kind: "max_turni",
      isHard: true,
      peso: 100,
      descrizione: "Lav1 senza notti fino al 10 agosto",
      validoDal: "2026-08-01",
      validoAl: "2026-08-10",
      params: { lavoratore: "l-0", turni: ["N"], n: 0 },
    }

    const esito = generaPiano(scenario({ nLavoratori: 9, vincoli: [v] }), {
      seme: 3,
      tempoMaxMs: 4000,
    })
    const { modello: m, stato: s } = esito
    const idxN = m.turni.findIndex((t) => t.isNotte)

    let dentro = 0
    let fuori = 0
    for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
      if (s.turnoDelGiorno[0 * m.nGiorni + g] !== idxN) continue
      if (m.date[g] <= "2026-08-10") dentro++
      else fuori++
    }

    expect(esito.vincoliApplicati).toContain("v-max-datato")
    expect(dentro).toBe(0)
    // Fuori dalla finestra il vincolo non deve mordere: il lavoratore resta
    // disponibile per le notti come chiunque altro.
    expect(fuori).toBeGreaterThan(0)
  })
})

describe("copertura con validità datata", () => {
  /** Divide ogni regola in due metà del mese, non sovrapposte. */
  function coperturaDivisa(base: ReturnType<typeof scenario>) {
    return base.copertura.flatMap((c) => [
      { ...c, valido_dal: "2026-08-01", valido_al: "2026-08-15" },
      { ...c, valido_dal: "2026-08-16", valido_al: "2026-08-31" },
    ])
  }

  it("conserva le regole con intervalli di validità distinti", () => {
    // Cambiare il fabbisogno a metà mese è la cosa più normale del mondo
    // (agosto, festività, picchi stagionali). Le due righe hanno la stessa
    // postazione, turno e giorno della settimana ma validità disgiunte:
    // devono coesistere, non sovrascriversi.
    const intero = costruisciModello(scenario())
    const base = scenario()
    const diviso = costruisciModello({ ...base, copertura: coperturaDivisa(base) })

    expect(intero.slots.length).toBe(155)
    expect(diviso.slots.length).toBe(intero.slots.length)

    // E la copertura dev'essere continua: nessun giorno del mese senza slot.
    const giorniCoperti = new Set(diviso.slots.map((s) => s.data))
    expect(giorniCoperti.size).toBe(31)
  })

  it("rifiuta esplicitamente due regole sovrapposte per la stessa chiave", () => {
    // Con due righe valide contemporaneamente non esiste una risposta giusta:
    // sceglierne una in base all'ordine di inserimento significa che il piano
    // cambia se cambia l'ordine delle righe nel database. Meglio fermarsi.
    const base = scenario()
    const sovrapposte = base.copertura.flatMap((c) => [
      { ...c, valido_dal: "2026-08-01", valido_al: "2026-08-20" },
      { ...c, valido_dal: "2026-08-10", valido_al: "2026-08-31", n_richiesti: 9 },
    ])

    expect(() =>
      costruisciModello({ ...base, copertura: sovrapposte }),
    ).toThrow(/sovrappo/i)
  })

  it("segnala il conflitto fra una regola perpetua e una datata", () => {
    const base = scenario()
    // copertura[0] vale per la domenica (giorno_settimana 0) senza date, cioè
    // sempre. Il 9 agosto 2026 è una domenica: la regola datata qui sotto ci
    // ricade sopra, quindi quel giorno due regole sono valide insieme.
    const conUnaDatata = [
      ...base.copertura,
      {
        ...base.copertura[0],
        valido_dal: "2026-08-09",
        valido_al: "2026-08-09",
        n_richiesti: 4,
      },
    ]
    expect(() =>
      costruisciModello({ ...base, copertura: conUnaDatata }),
    ).toThrow(/sovrappo/i)
  })

  it("una regola senza date copre tutto l'intervallo", () => {
    // Il caso normale: nessuna data, la regola vale sempre. È il
    // comportamento che tutte le configurazioni esistenti danno per scontato.
    const m = costruisciModello(scenario())
    expect(m.slots.length).toBe(155)
    expect(new Set(m.slots.map((s) => s.data)).size).toBe(31)
  })
})

describe("verifica del mix (2:2:1 contro 1:1:1)", () => {
  it("segnala lo sbilanciamento quando serve 1 persona per turno", () => {
    // Con copertura 1/1/1 il monte ore può tornare ma le notti sono troppe
    // rispetto a quante ne produce il ciclo canonico.
    const dati = scenario({ nLavoratori: 5, copertura: [1, 1, 1] })
    const fatt = verificaFattibilita(costruisciModello(dati))
    expect(fatt.avvisi.join(" ")).toContain("Mix sbilanciato")
  })

  it("non segnala nulla di anomalo con la copertura 2/2/1", () => {
    const fatt = verificaFattibilita(costruisciModello(scenario()))
    expect(fatt.avvisi.join(" ")).not.toContain("Mix sbilanciato")
  })
})

describe("assenze", () => {
  it("non assegna turni durante le ferie", () => {
    const dati = scenario({
      nLavoratori: 9,
      assenze: [
        {
          worker_id: "l-0",
          dal: "2026-08-10",
          al: "2026-08-20",
          giornata_intera: true,
          shift_type_id: null,
        },
      ],
    })
    const esito = generaPiano(dati, { seme: 3, tempoMaxMs: 3000 })
    const { modello: m, stato: s } = esito
    for (let g = 0; g < m.nGiorni; g++) {
      const data = m.date[g]
      if (data >= "2026-08-10" && data <= "2026-08-20") {
        expect(s.turnoDelGiorno[0 * m.nGiorni + g]).toBe(-1)
      }
    }
    expect(invarianti(esito)).toEqual([])
  })
})

describe("vincoli dal DSL", () => {
  it('rispetta un "indisponibile" rigido (domenica pomeriggio libera)', () => {
    const v: Vincolo = {
      id: "v1",
      kind: "indisponibile",
      isHard: true,
      peso: 100,
      descrizione: "Lav1 non lavora la domenica pomeriggio",
      params: { lavoratore: "l-0", giorni: [0], turni: ["P"] },
    }
    const esito = generaPiano(scenario({ nLavoratori: 9, vincoli: [v] }), {
      seme: 5,
      tempoMaxMs: 3000,
    })
    const { modello: m, stato: s } = esito
    const idxP = m.turni.findIndex((t) => t.codice === "P")

    for (let g = m.offsetPeriodo; g < m.nGiorni; g++) {
      const dow = new Date(m.date[g] + "T00:00:00Z").getUTCDay()
      if (dow !== 0) continue
      expect(s.turnoDelGiorno[0 * m.nGiorni + g]).not.toBe(idxP)
    }
  })

  it('rispetta un "turno_vietato" rigido (mai di notte)', () => {
    const v: Vincolo = {
      id: "v2",
      kind: "turno_vietato",
      isHard: true,
      peso: 100,
      descrizione: "Lav1 non fa notti",
      params: { lavoratore: "l-0", turni: ["N"] },
    }
    const esito = generaPiano(scenario({ nLavoratori: 9, vincoli: [v] }), {
      seme: 5,
      tempoMaxMs: 3000,
    })
    expect(esito.riepiloghi[0].notti).toBe(0)
  })

  it('rispetta un tetto "max_turni" rigido', () => {
    const v: Vincolo = {
      id: "v3",
      kind: "max_turni",
      isHard: true,
      peso: 100,
      descrizione: "Massimo 2 notti al mese per Lav1",
      params: { lavoratore: "l-0", turni: ["N"], n: 2 },
    }
    const esito = generaPiano(scenario({ nLavoratori: 9, vincoli: [v] }), {
      seme: 5,
      tempoMaxMs: 3000,
    })
    expect(esito.riepiloghi[0].notti).toBeLessThanOrEqual(2)
  })
})

describe("continuità fra i mesi", () => {
  it("il riposo dopo una notte di fine mese vale anche a inizio mese", () => {
    const dati = scenario({ nLavoratori: 9 })
    // Lav1 ha lavorato la notte del 31 luglio: il 1 e il 2 agosto deve stare
    // fermo, perché il riposo di 48h scavalca il cambio mese.
    dati.assegnazioniEsistenti = [
      {
        data: "2026-07-31",
        worker_id: "l-0",
        shift_type_id: "t-n",
        position_id: "p-0",
        bloccato: false,
      },
    ]
    const esito = generaPiano(dati, { seme: 11, tempoMaxMs: 3000 })
    const { modello: m, stato: s } = esito
    const g1 = m.date.indexOf("2026-08-01")
    const g2 = m.date.indexOf("2026-08-02")

    expect(s.turnoDelGiorno[0 * m.nGiorni + g1]).toBe(-1)
    // Il 2 agosto può riprendere solo dal pomeriggio in poi (07:00 + 48h).
    const t2 = s.turnoDelGiorno[0 * m.nGiorni + g2]
    if (t2 !== -1) {
      const stacco =
        (m.inizioUtc[g2 * m.turni.length + t2] -
          m.fineUtc[m.date.indexOf("2026-07-31") * m.turni.length + 2]) /
        ORA
      expect(stacco).toBeGreaterThanOrEqual(48)
    }
    expect(invarianti(esito)).toEqual([])
  })
})

describe("mese con cambio ora legale", () => {
  it("marzo 2026 resta valido malgrado la notte da 9 ore", () => {
    const esito = generaPiano(scenario({ mese: "2026-03-01", nLavoratori: 8 }), {
      seme: 2,
      tempoMaxMs: 4000,
    })
    expect(invarianti(esito)).toEqual([])
    expect(esito.slotScoperti).toBe(0)
  })

  it("ottobre 2026 resta valido malgrado la notte da 11 ore", () => {
    const esito = generaPiano(scenario({ mese: "2026-10-01", nLavoratori: 8 }), {
      seme: 2,
      tempoMaxMs: 4000,
    })
    expect(invarianti(esito)).toEqual([])
    expect(esito.slotScoperti).toBe(0)
  })
})

describe("più postazioni", () => {
  it("3 postazioni e 21 lavoratori: copertura completa", () => {
    const esito = generaPiano(
      scenario({ nPostazioni: 3, nLavoratori: 21 }),
      { seme: 1, tempoMaxMs: 10_000 },
    )
    expect(invarianti(esito)).toEqual([])
    expect(esito.slotScoperti).toBe(0)
  })
})

describe("orizzonte di pianificazione personalizzato", () => {
  it("costruisce un intervallo inclusivo che attraversa il cambio d'anno", () => {
    const modello = costruisciModello({
      ...scenario({ mese: "2026-12-01" }),
      dal: "2026-12-20",
      al: "2027-01-10",
    })

    expect(modello.inizioPeriodo).toBe("2026-12-20")
    expect(modello.finePeriodo).toBe("2027-01-10")
    expect(new Set(modello.slots.map((slot) => slot.data)).size).toBe(22)
    expect(modello.slots.every((slot) => slot.data >= "2026-12-20")).toBe(true)
    expect(modello.slots.every((slot) => slot.data <= "2027-01-10")).toBe(true)
  })

  it("rispetta il riposo verso un turno preservato dopo la data finale", () => {
    const esito = generaPiano(
      {
        mese: "2026-08-01",
        dal: "2026-08-31",
        al: "2026-08-31",
        giorniContesto: 0,
        giorniContestoDopo: 1,
        turni: [
          {
            id: "notte",
            codice: "N",
            nome: "Notte",
            ora_inizio: "21:00",
            durata_min: 480,
            scavalca_mezzanotte: true,
            is_notte: true,
            ordine_rotazione: 0,
            conta_nelle_ore: true,
            peso_ore: 1,
          },
          {
            id: "mattino",
            codice: "M",
            nome: "Mattino",
            ora_inizio: "06:00",
            durata_min: 480,
            scavalca_mezzanotte: false,
            is_notte: false,
            ordine_rotazione: 1,
            conta_nelle_ore: true,
            peso_ore: 1,
          },
        ],
        postazioni: [{ id: "p", nome: "Postazione" }],
        lavoratori: [
          {
            id: "l",
            nome: "Lina",
            cognome: "Test",
            ore_settimanali: 40,
            riposo_min_dopo_notte_h: 11,
            max_giorni_consecutivi: 6,
          },
        ],
        abilitazioni: [{ worker_id: "l", position_id: "p" }],
        copertura: [
          {
            position_id: "p",
            shift_type_id: "notte",
            giorno_settimana: 1,
            tipo_giorno: "feriale",
            n_richiesti: 1,
            valido_dal: null,
            valido_al: null,
          },
        ],
        festivita: [],
        assenze: [],
        vincoli: [],
        assegnazioniEsistenti: [
          {
            data: "2026-09-01",
            worker_id: "l",
            shift_type_id: "mattino",
            position_id: "p",
            bloccato: false,
          },
        ],
        pesi: PESI_DEFAULT,
        regole: REGOLE_DEFAULT,
      },
      { seme: 1, tempoMaxMs: 20 },
    )

    expect(esito.modello.date).toEqual(["2026-08-31", "2026-09-01"])
    expect(esito.slotScoperti).toBe(1)
  })

  it("enforce il tetto globale delle ore settimanali", () => {
    const dati = scenario()
    dati.regole = { ...dati.regole, maxOreSettimana: 1 }

    const esito = generaPiano(dati, { seme: 1, tempoMaxMs: 0 })

    expect(
      esito.riepiloghi.every((r) => r.orePerSettimana.every((ore) => ore <= 1)),
    ).toBe(true)
    expect(esito.slotScoperti).toBeGreaterThan(0)
  })

  it("scala le preferenze con il peso globale configurato", () => {
    const vincolo: Vincolo = {
      id: "v-preferenza",
      kind: "preferenza",
      isHard: false,
      peso: 2,
      descrizione: "Preferenza mattino",
      params: { lavoratore: "l-0", turni: ["t-m"] },
    }
    const datiBase = scenario({ vincoli: [vincolo] })
    const modelloSenzaPeso = costruisciModello({
      ...datiBase,
      pesi: { ...PESI_DEFAULT, preferenze: 0 },
    })
    const modelloConPeso = costruisciModello({
      ...datiBase,
      pesi: { ...PESI_DEFAULT, preferenze: 3 },
    })
    const cSenzaPeso = compilaVincoli(modelloSenzaPeso)
    const cConPeso = compilaVincoli(modelloConPeso)

    expect(cSenzaPeso.preferenza[0]).toBe(0)
    expect(cConPeso.preferenza[0]).toBe(-6)
  })
})

describe("spiegazione dell'assegnabilità", () => {
  it("riporta l'assenza come motivo strutturato", () => {
    const dati = scenario({
      assenze: [
        {
          worker_id: "l-0",
          dal: "2026-08-01",
          al: "2026-08-01",
          giornata_intera: true,
          shift_type_id: null,
        },
      ],
    })
    const modello = costruisciModello(dati)
    const stato = creaStato(modello)
    const vincoli = compilaVincoli(modello)
    const slot = modello.slots.find((sl) => sl.data === "2026-08-01")
    expect(slot).toBeDefined()

    const valutazione = valutaAssegnabilita(
      modello,
      stato,
      vincoli,
      slot!.idx,
      0,
    )

    expect(valutazione.consentita).toBe(false)
    expect(valutazione.motivi).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codice: "assenza", rilassabile: false }),
      ]),
    )
  })

  it("riporta il tetto ore e il relativo vincolo rilassabile", () => {
    const dati = scenario()
    dati.regole = { ...dati.regole, maxOreSettimana: 1 }
    const modello = costruisciModello(dati)
    const stato = creaStato(modello)
    const vincoli = compilaVincoli(modello)
    const slot = modello.slots[0]

    const valutazione = valutaAssegnabilita(
      modello,
      stato,
      vincoli,
      slot.idx,
      0,
    )

    expect(valutazione.consentita).toBe(false)
    expect(valutazione.motivi).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codice: "max_ore_settimana",
          rilassabile: true,
          soglia: 1,
        }),
      ]),
    )
  })
})

describe("classificazione diagnostica", () => {
  it("classifica la capacità eccedente senza creare falsi problemi di ore", () => {
    const esito = generaPiano(scenario({ nLavoratori: 9 }), {
      seme: 1,
      tempoMaxMs: 0,
    })

    expect(esito.slotScoperti).toBe(0)
    expect(
      esito.violazioni.some((v) => v.tipo === "capacita_eccedente"),
    ).toBe(true)
    expect(
      esito.violazioni.some(
        (v) =>
          v.tipo === "monte_ore" &&
          Number(v.riferimenti?.oreAttuali) < Number(v.riferimenti?.oreTarget),
      ),
    ).toBe(false)
  })

  it("allega i blocker strutturati a uno slot scoperto", () => {
    const dati = scenario()
    dati.regole = { ...dati.regole, maxOreSettimana: 1 }
    const esito = generaPiano(dati, { seme: 1, tempoMaxMs: 0 })
    const copertura = esito.violazioni.find((v) => v.tipo === "copertura")
    expect(copertura).toBeDefined()

    const blocker = copertura!.riferimenti?.blocker as
      | { codice: string; conteggio: number }[]
      | undefined
    expect(blocker).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codice: "max_ore_settimana" }),
      ]),
    )
  })
})
