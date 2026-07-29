import { generateText } from "ai"
import { NextResponse } from "next/server"

import { traduciErrore } from "@/lib/ai/errori"
import {
  ErroreConfigurazioneAI,
  ottieniModello,
  statoProvider,
} from "@/lib/ai/provider"
import { ePianificatore } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

/** Elenco dei provider e stato della configurazione, per /impostazioni. */
export async function GET() {
  if (!(await ePianificatore())) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 })
  }
  return NextResponse.json({
    provider: statoProvider(),
    attivo: process.env.AI_PROVIDER ?? "glm",
    modello: process.env.AI_MODEL ?? null,
  })
}

/** Prova di connessione: verifica chiave, endpoint e latenza reale. */
export async function POST(req: Request) {
  if (!(await ePianificatore())) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 })
  }

  const corpo = await req.json().catch(() => ({}))
  const t0 = Date.now()

  // Risolvo il modello fuori dal try della chiamata, così un errore di
  // configurazione resta distinguibile da un errore del provider.
  let risolto
  try {
    risolto = ottieniModello({
      provider: corpo.provider ?? null,
      modello: corpo.modello ?? null,
    })
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        errore: e instanceof Error ? e.message : "Errore imprevisto.",
        latenzaMs: 0,
      },
      { status: e instanceof ErroreConfigurazioneAI ? 400 : 502 },
    )
  }

  try {
    const esito = await generateText({
      model: risolto.modello,
      prompt: "Rispondi con la sola parola: ok",
      maxRetries: 0, // è una prova: deve fallire subito e dire perché
    })

    return NextResponse.json({
      ok: true,
      provider: risolto.provider,
      modello: risolto.nomeModello,
      latenzaMs: Date.now() - t0,
      risposta: esito.text.trim().slice(0, 100),
    })
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        errore: traduciErrore(e, risolto.provider, risolto.nomeModello).message,
        latenzaMs: Date.now() - t0,
      },
      { status: 502 },
    )
  }
}
