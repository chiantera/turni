import { NextResponse } from "next/server"

import {
  ErroreIntervalloPianificazione,
  intervalloDaParametri,
} from "@/lib/dati/intervallo"
import { caricaDatiSolver } from "@/lib/dati/piano"
import { costruisciModello, verificaFattibilita } from "@/lib/solver"
import { ePianificatore } from "@/lib/supabase/server"

export const runtime = "nodejs"

/**
 * Verifica dell'organico PRIMA di generare.
 * Serve a distinguere un problema di personale da un difetto del solver: se
 * mancano persone, il piano avrà buchi qualunque algoritmo si usi.
 */
export async function GET(req: Request) {
  if (!(await ePianificatore())) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 })
  }

  const parametri = new URL(req.url).searchParams
  let intervallo
  try {
    intervallo = intervalloDaParametri({
      mese: parametri.get("mese") ?? parametri.get("dal") ?? "",
      dal: parametri.get("dal") ?? undefined,
      al: parametri.get("al") ?? undefined,
    })
  } catch (errore) {
    const messaggio =
      errore instanceof ErroreIntervalloPianificazione
        ? errore.message
        : "Intervallo di pianificazione non valido."
    return NextResponse.json({ errore: messaggio }, { status: 400 })
  }

  try {
    const dati = await caricaDatiSolver(intervallo.dal, intervallo.al)
    const modello = costruisciModello(dati)
    return NextResponse.json(verificaFattibilita(modello))
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : "Errore imprevisto."
    return NextResponse.json({ errore: messaggio }, { status: 500 })
  }
}
