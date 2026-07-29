import { NextResponse } from "next/server"

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
  mesiIntervallo,
  segnalazioneRilevante,
} from "@/lib/dati/intervallo"
import { caricaDatiSolver } from "@/lib/dati/piano"
import { creaClientServer, ePianificatore } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

function riferimentiOggetto(valore: unknown): Record<string, unknown> | undefined {
  return valore !== null && typeof valore === "object" && !Array.isArray(valore)
    ? (valore as Record<string, unknown>)
    : undefined
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
    const piani = await sb
      .from("schedules")
      .select("id")
      .in("mese", mesiIntervallo(intervallo.dal, intervallo.al))
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
        gravita: segnalazione.gravita,
        tipo: segnalazione.tipo,
        messaggio: segnalazione.messaggio,
        data: segnalazione.data,
        riferimenti: riferimentiOggetto(segnalazione.riferimenti),
      })),
      lavoratori: dati.lavoratori.map((l) => ({
        nome: `${l.nome} ${l.cognome}`,
        oreSettimanali: l.ore_settimanali,
        postazioni: abilitazioniPerLavoratore.get(l.id) ?? [],
      })),
      turni: dati.turni.map((t) => ({ codice: t.codice, nome: t.nome })),
      copertura: dati.copertura.map((c) => ({
        postazione: postazionePerId.get(c.position_id) ?? c.position_id,
        turno: turnoPerId.get(c.shift_type_id)?.codice ?? c.shift_type_id,
        giornoSettimana: c.giorno_settimana,
        tipoGiorno: c.tipo_giorno,
        richiesti: c.n_richiesti,
      })),
      assenze: dati.assenze.length,
      vincoli: dati.vincoli.map((v) => v.descrizione),
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
