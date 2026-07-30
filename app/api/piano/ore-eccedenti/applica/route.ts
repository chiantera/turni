import { NextResponse } from "next/server"

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
    const stato =
      error.code === "42501" ? 403 : error.code === "40001" ? 409 : error.code === "P0002" ? 404 : 400
    return NextResponse.json(
      {
        errore:
          error.code === "40001"
            ? "Il piano è cambiato. Ricalcola il preview prima di applicare."
            : "Applicazione della riduzione non riuscita.",
      },
      { status: stato },
    )
  }

  return NextResponse.json({ salvate: data ?? 0 })
}
