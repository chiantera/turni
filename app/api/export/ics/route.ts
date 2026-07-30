import { createEvents, type EventAttributes } from "ics"
import { NextResponse } from "next/server"

import {
  ErroreIntervalloPianificazione,
  intervalloDaParametri,
} from "@/lib/dati/intervallo"
import { oraInMinuti, pezziData } from "@/lib/solver/tempo"
import { creaClientServer, utenteCorrente } from "@/lib/supabase/server"

export const runtime = "nodejs"

/**
 * Calendario personale in formato ICS, importabile su telefono.
 *
 * Senza `worker` esporta i turni di chi ha effettuato l'accesso: così un
 * lavoratore può scaricare i propri turni senza vedere quelli degli altri.
 * Con `worker` esporta quelli di un collega, ma solo se chi chiede è un
 * pianificatore — il controllo lo fa comunque anche RLS.
 */
export async function GET(req: Request) {
  const corrente = await utenteCorrente()
  if (!corrente) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 })
  }

  const url = new URL(req.url)
  let intervallo
  try {
    intervallo = intervalloDaParametri({
      mese: url.searchParams.get("mese") ?? url.searchParams.get("dal") ?? "",
      dal: url.searchParams.get("dal") ?? undefined,
      al: url.searchParams.get("al") ?? undefined,
    })
  } catch (errore) {
    const messaggio =
      errore instanceof ErroreIntervalloPianificazione
        ? errore.message
        : "Intervallo non valido."
    return NextResponse.json({ errore: messaggio }, { status: 400 })
  }

  const pianificatore =
    corrente.profilo?.ruolo === "admin" || corrente.profilo?.ruolo === "pianificatore"
  const richiesto = url.searchParams.get("worker")
  const workerId = pianificatore ? (richiesto ?? corrente.profilo?.worker_id) : corrente.profilo?.worker_id

  if (!workerId) {
    return NextResponse.json(
      { errore: "Il tuo profilo non è collegato a un lavoratore." },
      { status: 400 },
    )
  }

  const { dal, al } = intervallo

  const sb = await creaClientServer()
  const run = await sb
    .from("planning_runs")
    .select("id")
    .eq("dal", dal)
    .eq("al", al)
    .maybeSingle()
  if (run.error) throw run.error
  if (!run.data) {
    return NextResponse.json({ errore: "Nessun piano per questo intervallo." }, { status: 404 })
  }
  const segmenti = await sb
    .from("schedules")
    .select("id")
    .eq("planning_run_id", run.data.id)
  if (segmenti.error) throw segmenti.error
  const [assegnazioni, turni, postazioni, lavoratore] = await Promise.all([
    sb
      .from("assignments")
      .select("*")
      .eq("worker_id", workerId)
      .in("schedule_id", segmenti.data.map((segmento) => segmento.id))
      .gte("data", dal)
      .lte("data", al)
      .order("data"),
    sb.from("shift_types").select("*"),
    sb.from("positions").select("*"),
    sb.from("workers").select("nome, cognome").eq("id", workerId).maybeSingle(),
  ])

  const turnoPerId = new Map((turni.data ?? []).map((t) => [t.id, t]))
  const postPerId = new Map((postazioni.data ?? []).map((p) => [p.id, p]))

  const eventi: EventAttributes[] = []
  for (const a of assegnazioni.data ?? []) {
    const t = turnoPerId.get(a.shift_type_id)
    if (!t) continue
    const p = postPerId.get(a.position_id)
    const [anno, m, g] = pezziData(a.data)
    const inizioMin = oraInMinuti(t.ora_inizio)

    eventi.push({
      title: `${t.nome}${p ? ` — ${p.nome}` : ""}`,
      description: `Turno ${t.codice} (${t.ora_inizio.slice(0, 5)}–${t.ora_fine.slice(0, 5)})`,
      location: p?.nome,
      // ics interpreta questi campi come ora locale: corretto, perché un
      // turno "che inizia alle 21" resta tale anche cambiando l'ora legale.
      start: [anno, m, g, Math.floor(inizioMin / 60), inizioMin % 60],
      duration: { minutes: t.durata_min },
      productId: "turni",
      calName: `Turni ${lavoratore.data ? `${lavoratore.data.nome} ${lavoratore.data.cognome}` : ""}`.trim(),
    })
  }

  if (eventi.length === 0) {
    return NextResponse.json(
      { errore: "Nessun turno assegnato in questo intervallo." },
      { status: 404 },
    )
  }

  const { error, value } = createEvents(eventi)
  if (error || !value) {
    return NextResponse.json(
      { errore: error?.message ?? "Generazione del calendario non riuscita." },
      { status: 500 },
    )
  }

  return new NextResponse(value, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="turni-${dal}-${al}.ics"`,
    },
  })
}
