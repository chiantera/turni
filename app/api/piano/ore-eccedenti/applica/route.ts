import { NextResponse } from "next/server"

import { interpretaErrorePiano } from "@/lib/dati/errori-piano"
import { creaClientServer, ePianificatore } from "@/lib/supabase/server"

export async function POST(req: Request) {
  if (!(await ePianificatore())) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ errore: "Corpo JSON non valido." }, { status: 400 })
  }
  const r = corpo && typeof corpo === "object" ? (corpo as Record<string, unknown>) : {}
  const planningRunId = typeof r.planningRunId === "string" ? r.planningRunId : ""
  const versione = typeof r.versione === "number" && Number.isInteger(r.versione) ? r.versione : null
  const precondizioni = r.precondizioni

  if (!planningRunId || versione === null || !Array.isArray(precondizioni)) {
    return NextResponse.json({ errore: "Richiesta di applicazione non valida." }, { status: 400 })
  }

  const sb = await creaClientServer()
  const { data, error } = await sb.rpc("applica_riduzione_ore", {
    p_planning_run_id: planningRunId,
    p_versione: versione,
    p_precondizioni: precondizioni,
  })
  if (error) {
    const esito = interpretaErrorePiano(error, "Applicazione della riduzione non riuscita.")
    return NextResponse.json({ errore: esito.messaggio }, { status: esito.stato })
  }

  return NextResponse.json({ salvate: data ?? 0 })
}
