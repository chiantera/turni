import { NextResponse } from "next/server"

import { generaSuggerimentiPiano } from "@/lib/ai/analisi-segnalazioni"
import { ErroreConfigurazioneAI } from "@/lib/ai/provider"
import type { ContestoSuggerimentiPiano } from "@/lib/ai/suggerimenti-piano"
import { caricaDatiSolver } from "@/lib/dati/piano"
import { creaClientServer, ePianificatore } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  if (!(await ePianificatore())) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 })
  }

  const corpo = await req.json().catch(() => ({}))
  const mese = typeof corpo.mese === "string" ? corpo.mese : ""
  if (!/^\d{4}-\d{2}-01$/.test(mese)) {
    return NextResponse.json({ errore: "Mese non valido." }, { status: 400 })
  }

  const sb = await creaClientServer()
  try {
    const piano = await sb
      .from("schedules")
      .select("id")
      .eq("mese", mese)
      .maybeSingle()
    if (piano.error) throw piano.error
    if (!piano.data) {
      return NextResponse.json({ errore: "Nessun piano per questo mese." }, { status: 404 })
    }

    const segnalazioni = await sb
      .from("violations")
      .select("gravita, tipo, messaggio, data")
      .eq("schedule_id", piano.data.id)
    if (segnalazioni.error) throw segnalazioni.error
    if (!segnalazioni.data?.length) {
      return NextResponse.json(
        { errore: "Il piano non contiene segnalazioni da analizzare." },
        { status: 400 },
      )
    }

    const dati = await caricaDatiSolver(mese)
    const postazionePerId = new Map(dati.postazioni.map((p) => [p.id, p.nome]))
    const turnoPerId = new Map(dati.turni.map((t) => [t.id, t]))
    const abilitazioniPerLavoratore = new Map<string, string[]>()
    for (const abilitazione of dati.abilitazioni) {
      const nomi = abilitazioniPerLavoratore.get(abilitazione.worker_id) ?? []
      const nome = postazionePerId.get(abilitazione.position_id)
      if (nome) nomi.push(nome)
      abilitazioniPerLavoratore.set(abilitazione.worker_id, nomi)
    }

    const contesto: ContestoSuggerimentiPiano = {
      mese,
      segnalazioni: segnalazioni.data.slice(0, 100),
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

    const esito = await generaSuggerimentiPiano(contesto, {
      provider: corpo.provider ?? null,
      modello: corpo.modello ?? null,
    })

    await sb.from("ai_interactions").insert({
      testo: `Analisi delle segnalazioni del piano ${mese}`,
      risposta: esito as never,
      accettato: false,
      provider: esito.provider,
      modello: esito.modello,
      token_input: esito.tokenInput ?? null,
      token_output: esito.tokenOutput ?? null,
      latenza_ms: esito.latenzaMs,
    })

    return NextResponse.json(esito)
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : "Errore imprevisto."
    await sb.from("ai_interactions").insert({
      testo: `Analisi delle segnalazioni del piano ${mese}`,
      errore: messaggio,
    })
    return NextResponse.json(
      { errore: messaggio },
      { status: errore instanceof ErroreConfigurazioneAI ? 400 : 502 },
    )
  }
}
