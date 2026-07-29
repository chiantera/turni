import { NextResponse } from "next/server"

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

  const mese = new URL(req.url).searchParams.get("mese")
  if (!mese || !/^\d{4}-\d{2}-\d{2}$/.test(mese)) {
    return NextResponse.json({ errore: "Parametro 'mese' mancante." }, { status: 400 })
  }

  try {
    const dati = await caricaDatiSolver(mese)
    const modello = costruisciModello(dati)
    return NextResponse.json(verificaFattibilita(modello))
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : "Errore imprevisto."
    return NextResponse.json({ errore: messaggio }, { status: 500 })
  }
}
