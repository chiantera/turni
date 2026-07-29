import { NextResponse } from "next/server"

import { estraiVincoli } from "@/lib/ai/estrazione"
import { ErroreConfigurazioneAI } from "@/lib/ai/provider"
import { caricaContestoAI } from "@/lib/dati/piano"
import { creaClientServer, ePianificatore } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Estrae vincoli strutturati dal linguaggio naturale.
 *
 * NON scrive nulla nel database: restituisce PROPOSTE. L'applicazione dei
 * vincoli avviene solo dopo la conferma esplicita dell'utente, tramite
 * l'endpoint /api/vincoli. Questo è il punto in cui un fraintendimento
 * dell'AI verrebbe intercettato da una persona.
 */
export async function POST(req: Request) {
  if (!(await ePianificatore())) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 })
  }

  const corpo = await req.json().catch(() => ({}))
  const testo: string = (corpo.testo ?? "").trim()
  const mese: string = corpo.mese ?? new Date().toISOString().slice(0, 10)

  if (!testo) {
    return NextResponse.json({ errore: "Scrivi la richiesta da interpretare." }, { status: 400 })
  }
  if (testo.length > 2000) {
    return NextResponse.json({ errore: "Testo troppo lungo (massimo 2000 caratteri)." }, { status: 400 })
  }

  const sb = await creaClientServer()

  try {
    const contesto = await caricaContestoAI(mese)
    const esito = await estraiVincoli(testo, contesto, {
      provider: corpo.provider ?? null,
      modello: corpo.modello ?? null,
    })

    await sb.from("ai_interactions").insert({
      testo,
      risposta: esito as never,
      accettato: false,
      provider: esito.provider,
      modello: esito.modello,
      token_input: esito.tokenInput ?? null,
      token_output: esito.tokenOutput ?? null,
      latenza_ms: esito.latenzaMs,
    })

    return NextResponse.json(esito)
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : "Errore imprevisto."
    await sb.from("ai_interactions").insert({ testo, errore: messaggio })
    return NextResponse.json(
      { errore: messaggio },
      { status: e instanceof ErroreConfigurazioneAI ? 400 : 502 },
    )
  }
}
