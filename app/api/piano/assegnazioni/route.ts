import { NextResponse } from "next/server"

import {
  ErroreModifichePiano,
  preparaSalvataggioModifiche,
  validaModifichePiano,
} from "@/lib/dati/modifiche-piano"
import { creaClientServer, ePianificatore } from "@/lib/supabase/server"

export async function PUT(req: Request) {
  if (!(await ePianificatore())) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ errore: "Corpo JSON non valido." }, { status: 400 })
  }

  try {
    const r = corpo && typeof corpo === "object" ? (corpo as Record<string, unknown>) : {}
    const mese = typeof r.mese === "string" ? r.mese : ""
    const modifiche = validaModifichePiano(mese, r.modifiche)
    if (modifiche.length === 0) {
      return NextResponse.json({ salvate: 0 })
    }

    const sb = await creaClientServer()
    const piano = await sb.from("schedules").select("id").eq("mese", mese).maybeSingle()
    if (piano.error) throw piano.error
    if (!piano.data) {
      return NextResponse.json({ errore: "Nessun piano per questo mese." }, { status: 404 })
    }
    const scheduleId = piano.data.id

    const assegnate = modifiche.filter((m) => m.shiftTypeId && m.positionId)
    if (assegnate.length > 0) {
      const workerIds = [...new Set(assegnate.map((m) => m.workerId))]
      const shiftIds = [...new Set(assegnate.map((m) => m.shiftTypeId as string))]
      const positionIds = [...new Set(assegnate.map((m) => m.positionId as string))]
      const [lavoratori, turni, postazioni, abilitazioni] = await Promise.all([
        sb.from("workers").select("id").in("id", workerIds).eq("attivo", true),
        sb.from("shift_types").select("id").in("id", shiftIds).eq("attivo", true),
        sb.from("positions").select("id").in("id", positionIds).eq("attiva", true),
        sb
          .from("worker_positions")
          .select("worker_id, position_id")
          .in("worker_id", workerIds)
          .in("position_id", positionIds),
      ])
      for (const esito of [lavoratori, turni, postazioni, abilitazioni]) {
        if (esito.error) throw esito.error
      }

      const lavoratoriValidi = new Set((lavoratori.data ?? []).map((x) => x.id))
      const turniValidi = new Set((turni.data ?? []).map((x) => x.id))
      const postazioniValide = new Set((postazioni.data ?? []).map((x) => x.id))
      const coppieValide = new Set(
        (abilitazioni.data ?? []).map((x) => `${x.worker_id}:${x.position_id}`),
      )
      const nonValida = assegnate.find(
        (m) =>
          !lavoratoriValidi.has(m.workerId) ||
          !turniValidi.has(m.shiftTypeId as string) ||
          !postazioniValide.has(m.positionId as string) ||
          !coppieValide.has(`${m.workerId}:${m.positionId}`),
      )
      if (nonValida) {
        return NextResponse.json(
          { errore: "Una modifica usa un lavoratore, turno o postazione non valido." },
          { status: 400 },
        )
      }
    }

    const { daSalvare, daRimuovere } = preparaSalvataggioModifiche(
      scheduleId,
      modifiche,
    )
    if (daSalvare.length > 0) {
      const salvate = await sb.from("assignments").upsert(daSalvare, {
        onConflict: "schedule_id,data,worker_id",
      })
      if (salvate.error) throw salvate.error
    }

    const rimozioni = await Promise.all(
      daRimuovere.map((m) =>
        sb
          .from("assignments")
          .delete()
          .eq("schedule_id", scheduleId)
          .eq("worker_id", m.workerId)
          .eq("data", m.data),
      ),
    )
    const rimozioneFallita = rimozioni.find((x) => x.error)
    if (rimozioneFallita?.error) throw rimozioneFallita.error

    const aggiornato = await sb
      .from("schedules")
      .update({ aggiornato_il: new Date().toISOString() })
      .eq("id", scheduleId)
    if (aggiornato.error) throw aggiornato.error

    return NextResponse.json({
      salvate: modifiche.length,
      avviso: "Le segnalazioni mostrate si riferiscono all'ultima generazione automatica.",
    })
  } catch (errore) {
    if (errore instanceof ErroreModifichePiano) {
      return NextResponse.json({ errore: errore.message }, { status: 400 })
    }
    console.error("Salvataggio manuale del piano non riuscito", errore)
    return NextResponse.json(
      { errore: "Salvataggio delle modifiche non riuscito." },
      { status: 500 },
    )
  }
}
