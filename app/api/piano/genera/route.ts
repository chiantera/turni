import { NextResponse } from "next/server"

import {
  ErroreIntervalloPianificazione,
  intervalloDaParametri,
} from "@/lib/dati/intervallo"
import { caricaDatiSolver, salvaIntervalloPiani } from "@/lib/dati/piano"
import { ErroreCoperturaAmbigua } from "@/lib/solver/modello"
import { estraiAssegnazioni, generaPiano } from "@/lib/solver"
import { ePianificatore } from "@/lib/supabase/server"

// Il solver è puro calcolo su CPU: serve il runtime Node, non l'edge.
export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  if (!(await ePianificatore())) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 })
  }

  const corpo = await req.json().catch(() => ({}))
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
        : "Intervallo di pianificazione non valido."
    return NextResponse.json({ errore: messaggio }, { status: 400 })
  }

  const seme: number = Number.isFinite(corpo.seme) ? corpo.seme : 1
  const tempoMaxMs = Math.min(Number(corpo.tempoMaxMs) || 10_000, 45_000)

  try {
    const dati = await caricaDatiSolver(intervallo.dal, intervallo.al)

    if (dati.lavoratori.length === 0) {
      return NextResponse.json(
        { errore: "Nessun lavoratore attivo: aggiungi il personale prima di generare i turni." },
        { status: 400 },
      )
    }
    if (dati.postazioni.length === 0) {
      return NextResponse.json(
        { errore: "Nessuna postazione attiva: definisci le postazioni da coprire." },
        { status: 400 },
      )
    }

    const esito = generaPiano(dati, { seme, tempoMaxMs })
    const assegnazioni = estraiAssegnazioni(esito.modello, esito.stato)

    await salvaIntervalloPiani(
      intervallo.dal,
      intervallo.al,
      assegnazioni,
      esito.violazioni,
      {
        costo: esito.costo,
        scoperti: esito.slotScoperti,
        iterazioni: esito.iterazioni,
        tempoMs: esito.tempoMs,
      },
      seme,
    )

    return NextResponse.json({
      ok: true,
      slotTotali: esito.modello.slots.length,
      slotScoperti: esito.slotScoperti,
      iterazioni: esito.iterazioni,
      tempoMs: esito.tempoMs,
      violazioni: esito.violazioni,
      riepiloghi: esito.riepiloghi,
      fattibilita: esito.fattibilita,
    })
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : "Errore imprevisto."
    // Una copertura ambigua è un errore di configurazione, non un guasto del
    // server: chi legge deve capire che va corretta la griglia, non riprovare.
    const stato = e instanceof ErroreCoperturaAmbigua ? 400 : 500
    return NextResponse.json({ errore: messaggio }, { status: stato })
  }
}
