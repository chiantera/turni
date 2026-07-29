import { NextResponse } from "next/server"

import {
  ErroreModifichePiano,
  preparaSalvataggioModifiche,
  validaModificheIntervallo,
  validaModifichePiano,
} from "@/lib/dati/modifiche-piano"
import { primoDelMese } from "@/lib/solver/tempo"
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
    const dal = typeof r.dal === "string" ? r.dal : ""
    const al = typeof r.al === "string" ? r.al : ""
    const modifiche =
      dal || al
        ? validaModificheIntervallo(dal, al, r.modifiche)
        : validaModifichePiano(mese, r.modifiche)
    const precondizioni =
      r.precondizioni === undefined
        ? []
        : dal || al
          ? validaModificheIntervallo(dal, al, r.precondizioni)
          : validaModifichePiano(mese, r.precondizioni)
    if (r.precondizioni !== undefined && precondizioni.length !== modifiche.length) {
      return NextResponse.json(
        { errore: "Le precondizioni devono corrispondere a tutte le modifiche." },
        { status: 400 },
      )
    }
    if (precondizioni.length > 0) {
      const modifichePerCella = new Map(modifiche.map((m) => [`${m.workerId}:${m.data}`, m]))
      const precondizioniPerCella = new Map(
        precondizioni.map((p) => [`${p.workerId}:${p.data}`, p]),
      )
      const precondizioneMancante = modifiche.some((modifica) => {
        const precondizione = precondizioniPerCella.get(`${modifica.workerId}:${modifica.data}`)
        return (
          !precondizione ||
          !precondizione.shiftTypeId ||
          !precondizione.positionId ||
          modifichePerCella.get(`${precondizione.workerId}:${precondizione.data}`) !== modifica
        )
      })
      if (precondizioneMancante || precondizioniPerCella.size !== modifichePerCella.size) {
        return NextResponse.json(
          { errore: "Le precondizioni non corrispondono alle celle da modificare." },
          { status: 400 },
        )
      }
    }
    if (modifiche.length === 0) {
      return NextResponse.json({ salvate: 0 })
    }

    const sb = await creaClientServer()
    const mesiModificati = [...new Set(modifiche.map((m) => primoDelMese(m.data)))]
    const piani = await sb.from("schedules").select("id, mese").in("mese", mesiModificati)
    if (piani.error) throw piani.error
    const pianoPerMese = new Map((piani.data ?? []).map((p) => [p.mese, p.id]))

    if (precondizioni.length > 0) {
      const scheduleIds = [...pianoPerMese.values()]
      const correnti = await sb
        .from("assignments")
        .select("data, worker_id, shift_type_id, position_id")
        .in("schedule_id", scheduleIds)
        .gte("data", dal || "0000-01-01")
        .lte("data", al || "9999-12-31")
      if (correnti.error) throw correnti.error
      const presenti = new Set(
        (correnti.data ?? []).map(
          (assegnazione) =>
            `${assegnazione.worker_id}:${assegnazione.data}:${assegnazione.shift_type_id}:${assegnazione.position_id}`,
        ),
      )
      const obsoleta = precondizioni.find(
        (precondizione) =>
          !precondizione.shiftTypeId ||
          !precondizione.positionId ||
          !presenti.has(
            `${precondizione.workerId}:${precondizione.data}:${precondizione.shiftTypeId}:${precondizione.positionId}`,
          ),
      )
      if (obsoleta) {
        return NextResponse.json(
          { errore: "Il piano è cambiato dopo il preview. Ricalcola l'impatto prima di applicare." },
          { status: 409 },
        )
      }
    }

    const workerIds = [...new Set([...modifiche, ...precondizioni].map((m) => m.workerId))]
    const lavoratori = await sb
      .from("workers")
      .select("id")
      .in("id", workerIds)
      .eq("attivo", true)
    if (lavoratori.error) throw lavoratori.error
    const lavoratoriValidi = new Set((lavoratori.data ?? []).map((x) => x.id))
    if (modifiche.some((modifica) => !lavoratoriValidi.has(modifica.workerId))) {
      return NextResponse.json(
        { errore: "Una modifica usa un lavoratore non valido." },
        { status: 400 },
      )
    }

    const assegnate = modifiche.filter((m) => m.shiftTypeId && m.positionId)
    if (assegnate.length > 0) {
      const shiftIds = [...new Set(assegnate.map((m) => m.shiftTypeId as string))]
      const positionIds = [...new Set(assegnate.map((m) => m.positionId as string))]
      const [turni, postazioni, abilitazioni] = await Promise.all([
        sb.from("shift_types").select("id").in("id", shiftIds).eq("attivo", true),
        sb.from("positions").select("id").in("id", positionIds).eq("attiva", true),
        sb
          .from("worker_positions")
          .select("worker_id, position_id")
          .in("worker_id", workerIds)
          .in("position_id", positionIds),
      ])
      for (const esito of [turni, postazioni, abilitazioni]) {
        if (esito.error) throw esito.error
      }

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

    for (const meseModificato of mesiModificati) {
      if (pianoPerMese.has(meseModificato)) continue
      const creato = await sb
        .from("schedules")
        .upsert(
          {
            mese: meseModificato,
            seed: 1,
            parametri: dal && al ? ({ dal, al } as never) : undefined,
          },
          { onConflict: "mese" },
        )
        .select("id, mese")
        .single()
      if (creato.error || !creato.data) {
        throw creato.error ?? new Error("Impossibile creare il piano mensile.")
      }
      pianoPerMese.set(creato.data.mese, creato.data.id)
    }

    for (const meseModificato of mesiModificati) {
      const scheduleId = pianoPerMese.get(meseModificato) as string
      const modificheMese = modifiche.filter(
        (modifica) => primoDelMese(modifica.data) === meseModificato,
      )
      const { daSalvare, daRimuovere } = preparaSalvataggioModifiche(
        scheduleId,
        modificheMese,
      )
      if (daSalvare.length > 0) {
        const salvate = await sb.from("assignments").upsert(daSalvare, {
          onConflict: "schedule_id,data,worker_id",
        })
        if (salvate.error) throw salvate.error
      }

      const rimozioni = await Promise.all(
        daRimuovere.map((m) => {
          const precondizione = precondizioni.find(
            (p) => p.workerId === m.workerId && p.data === m.data,
          )
          let query = sb
            .from("assignments")
            .delete()
            .eq("schedule_id", scheduleId)
            .eq("worker_id", m.workerId)
            .eq("data", m.data)
            .select("id")
          if (precondizione?.shiftTypeId && precondizione.positionId) {
            query = query
              .eq("shift_type_id", precondizione.shiftTypeId)
              .eq("position_id", precondizione.positionId)
              .eq("bloccato", false)
          }
          return query
        }),
      )
      const rimozioneFallita = rimozioni.find((x) => x.error)
      if (rimozioneFallita?.error) throw rimozioneFallita.error
      if (precondizioni.length > 0 && rimozioni.some((x) => (x.data ?? []).length !== 1)) {
        return NextResponse.json(
          { errore: "Il piano è cambiato durante l'applicazione. Ricalcola il preview prima di riprovare." },
          { status: 409 },
        )
      }

      const aggiornato = await sb
        .from("schedules")
        .update({ aggiornato_il: new Date().toISOString() })
        .eq("id", scheduleId)
      if (aggiornato.error) throw aggiornato.error
    }

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
