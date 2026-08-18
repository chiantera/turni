import { NextResponse } from "next/server"
import { createHash } from "node:crypto"

import { generaSuggerimentiPiano } from "@/lib/ai/analisi-segnalazioni"
import { ErroreConfigurazioneAI } from "@/lib/ai/provider"
import {
  riduciContestoAllaSegnalazione,
  SchemaSuggerimentiPiano,
  segnalazioneIdDaCorpo,
  type ContestoSuggerimentiPiano,
} from "@/lib/ai/suggerimenti-piano"
import {
  ErroreIntervalloPianificazione,
  intervalloDaParametri,
  segnalazioneRilevante,
} from "@/lib/dati/intervallo"
import { caricaDatiSolver } from "@/lib/dati/piano"
import { serializzaDatiPerImpronta } from "@/lib/solver/serializzazione"
import { creaClientServer, ePianificatore } from "@/lib/supabase/server"
import { nomeCompleto } from "@/lib/solver/tipi"

export const runtime = "nodejs"
export const maxDuration = 60

function riferimentiOggetto(valore: unknown): Record<string, unknown> | undefined {
  return valore !== null && typeof valore === "object" && !Array.isArray(valore)
    ? (valore as Record<string, unknown>)
    : undefined
}

function diagnosticaDaPunteggio(valore: unknown): Record<string, unknown> | undefined {
  const punteggio = riferimentiOggetto(valore)
  return riferimentiOggetto(punteggio?.diagnostica)
}

export async function POST(req: Request) {
  if (!(await ePianificatore())) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 })
  }

  const corpoJson: unknown = await req.json().catch(() => ({}))
  const corpo =
    corpoJson !== null && typeof corpoJson === "object" && !Array.isArray(corpoJson)
      ? (corpoJson as Record<string, unknown>)
      : {}
  let segnalazioneId
  try {
    segnalazioneId = segnalazioneIdDaCorpo(corpo)
  } catch (errore) {
    return NextResponse.json(
      { errore: errore instanceof Error ? errore.message : "Segnalazione non valida." },
      { status: 400 },
    )
  }
  let intervallo
  try {
    intervallo = intervalloDaParametri({
      mese:
        typeof corpo.mese === "string"
          ? corpo.mese
          : typeof corpo.dal === "string"
            ? corpo.dal
            : "",
      dal: typeof corpo.dal === "string" ? corpo.dal : undefined,
      al: typeof corpo.al === "string" ? corpo.al : undefined,
    })
  } catch (errore) {
    const messaggio =
      errore instanceof ErroreIntervalloPianificazione
        ? errore.message
        : "Intervallo non valido."
    return NextResponse.json({ errore: messaggio }, { status: 400 })
  }

  const sb = await creaClientServer()
  try {
    const run = await sb
      .from("planning_runs")
      .select("id")
      .eq("dal", intervallo.dal)
      .eq("al", intervallo.al)
      .maybeSingle()
    if (run.error) throw run.error
    if (!run.data) {
      return NextResponse.json({ errore: "Nessun piano per questo intervallo." }, { status: 404 })
    }
    const piani = await sb
      .from("schedules")
      .select("id, punteggio")
      .eq("planning_run_id", run.data.id)
    if (piani.error) throw piani.error
    if (!piani.data?.length) {
      return NextResponse.json({ errore: "Nessun piano per questo intervallo." }, { status: 404 })
    }

    let querySegnalazioni = sb
      .from("violations")
      .select("id, gravita, tipo, messaggio, data, riferimenti")
      .in("schedule_id", piani.data.map((piano) => piano.id))
    if (segnalazioneId) querySegnalazioni = querySegnalazioni.eq("id", segnalazioneId)
    const segnalazioni = await querySegnalazioni
    if (segnalazioni.error) throw segnalazioni.error
    const segnalazioniRilevanti = (segnalazioni.data ?? []).filter(
      (segnalazione) =>
        segnalazioneRilevante(
          segnalazione.data,
          segnalazione.riferimenti,
          intervallo.dal,
          intervallo.al,
        ),
    )
    if (!segnalazioniRilevanti.length) {
      return NextResponse.json(
        {
          errore: segnalazioneId
            ? "Segnalazione non trovata nell’intervallo selezionato."
            : "Il piano non contiene segnalazioni da analizzare.",
        },
        { status: segnalazioneId ? 404 : 400 },
      )
    }

    const dati = await caricaDatiSolver(intervallo.dal, intervallo.al)
    const improntaInput = createHash("sha256")
      .update(serializzaDatiPerImpronta(dati))
      .digest("hex")
    const snapshot = diagnosticaDaPunteggio(piani.data?.[0]?.punteggio)
    const snapshotConStato = snapshot
      ? { ...snapshot, obsoleto: snapshot.improntaInput !== improntaInput }
      : { disponibile: false, obsoleto: true }
    const postazionePerId = new Map(dati.postazioni.map((p) => [p.id, p.nome]))
    const turnoPerId = new Map(dati.turni.map((t) => [t.id, t]))
    const abilitazioniPerLavoratore = new Map<string, string[]>()
    for (const abilitazione of dati.abilitazioni) {
      const nomi = abilitazioniPerLavoratore.get(abilitazione.worker_id) ?? []
      const nome = postazionePerId.get(abilitazione.position_id)
      if (nome) nomi.push(nome)
      abilitazioniPerLavoratore.set(abilitazione.worker_id, nomi)
    }

    const contestoCompleto: ContestoSuggerimentiPiano = {
      dal: intervallo.dal,
      al: intervallo.al,
      segnalazioni: segnalazioniRilevanti.slice(0, 100).map((segnalazione) => ({
        id: segnalazione.id,
        gravita: segnalazione.gravita,
        tipo: segnalazione.tipo,
        messaggio: segnalazione.messaggio,
        data: segnalazione.data,
        riferimenti: riferimentiOggetto(segnalazione.riferimenti),
      })),
      lavoratori: dati.lavoratori.map((l) => ({
        id: l.id,
        nome: nomeCompleto(l),
        oreSettimanali: l.ore_settimanali,
        postazioni: abilitazioniPerLavoratore.get(l.id) ?? [],
      })),
      turni: dati.turni.map((t) => ({ id: t.id, codice: t.codice, nome: t.nome })),
      copertura: dati.copertura.map((c) => ({
        postazioneId: c.position_id,
        turnoId: c.shift_type_id,
        postazione: postazionePerId.get(c.position_id) ?? c.position_id,
        turno: turnoPerId.get(c.shift_type_id)?.codice ?? c.shift_type_id,
        giornoSettimana: c.giorno_settimana,
        tipoGiorno: c.tipo_giorno,
        richiesti: c.n_richiesti,
      })),
      assenze: dati.assenze.length,
      vincoli: dati.vincoli.map((v) => v.descrizione),
      vincoliStrutturati: dati.vincoli.map((v) => ({
        id: v.id,
        kind: v.kind,
        isHard: v.isHard,
        peso: v.peso,
        descrizione: v.descrizione,
        params: v.params,
      })),
      regole: { ...dati.regole },
      pesi: { ...dati.pesi },
      snapshot: snapshotConStato,
    }
    const contesto = segnalazioneId
      ? riduciContestoAllaSegnalazione(
          contestoCompleto,
          contestoCompleto.segnalazioni[0],
        )
      : contestoCompleto

    const esito = await generaSuggerimentiPiano(contesto)

    const descrizioneInterazione = segnalazioneId
      ? `Analisi della segnalazione ${segnalazioneId}`
      : `Analisi delle segnalazioni dal ${intervallo.dal} al ${intervallo.al}`

    await sb.from("ai_interactions").insert({
      testo: descrizioneInterazione,
      risposta: esito as never,
      accettato: false,
      provider: esito.provider,
      modello: esito.modello,
      token_input: esito.tokenInput ?? null,
      token_output: esito.tokenOutput ?? null,
      latenza_ms: esito.latenzaMs,
    })

    return NextResponse.json(SchemaSuggerimentiPiano.parse(esito))
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : "Errore imprevisto."
    const erroreConfigurazione = errore instanceof ErroreConfigurazioneAI
    await sb.from("ai_interactions").insert({
      testo: segnalazioneId
        ? `Analisi della segnalazione ${segnalazioneId}`
        : `Analisi delle segnalazioni dal ${intervallo.dal} al ${intervallo.al}`,
      errore: messaggio,
    })
    return NextResponse.json(
      {
        errore: erroreConfigurazione
          ? "Il servizio AI non è configurato. Contatta l’amministratore."
          : "Il servizio AI non è disponibile. Riprova più tardi.",
      },
      { status: erroreConfigurazione ? 400 : 502 },
    )
  }
}
