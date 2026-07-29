import { NextResponse } from "next/server"

import { caricaDatiSolver } from "@/lib/dati/piano"
import { mesiIntervallo, validaIntervallo } from "@/lib/dati/intervallo"
import { costruisciModello } from "@/lib/solver/modello"
import { creaClientServer, ePianificatore } from "@/lib/supabase/server"

const MAX_LAVORATORI_CONCENTRATA = 10

type Politica = "concentrata" | "distribuita"

type Modifica = {
  workerId: string
  data: string
  shiftTypeId: string | null
  positionId: string | null
}

type Candidato = Modifica & {
  ore: number
  attualeShiftTypeId: string
  attualePositionId: string
  gruppo: string
  limiteGruppo: number
}

function oreTurno(
  shiftTypeId: string,
  turni: Map<string, { durata_min: number; peso_ore: number; conta_nelle_ore: boolean }>,
): number {
  const turno = turni.get(shiftTypeId)
  return turno?.conta_nelle_ore ? (turno.durata_min * turno.peso_ore) / 60 : 0
}

function scegliCandidati(
  candidati: Candidato[],
  politica: Politica,
): Candidato[] {
  const perLavoratore = new Map<string, number>()
  for (const candidato of candidati) {
    perLavoratore.set(
      candidato.workerId,
      (perLavoratore.get(candidato.workerId) ?? 0) + candidato.ore,
    )
  }

  const lavoratoriOrdinati = [...perLavoratore.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
  const gruppoConcentrato = new Set(
    lavoratoriOrdinati
      .slice(0, MAX_LAVORATORI_CONCENTRATA)
      .map(([workerId]) => workerId),
  )
  const oreRimosse = new Map<string, number>()
  const scelti: Candidato[] = []
  const perGruppo = new Map<string, Candidato[]>()
  for (const candidato of candidati) {
    const gruppo = perGruppo.get(candidato.gruppo) ?? []
    gruppo.push(candidato)
    perGruppo.set(candidato.gruppo, gruppo)
  }

  for (const gruppo of perGruppo.values()) {
    const disponibili = [...gruppo]
    for (let indice = 0; indice < (gruppo[0]?.limiteGruppo ?? 0); indice++) {
      disponibili.sort((a, b) =>
        politica === "concentrata"
          ? Number(gruppoConcentrato.has(b.workerId)) - Number(gruppoConcentrato.has(a.workerId)) ||
            b.ore - a.ore ||
            a.data.localeCompare(b.data) ||
            a.workerId.localeCompare(b.workerId)
          : (oreRimosse.get(a.workerId) ?? 0) - (oreRimosse.get(b.workerId) ?? 0) ||
            a.data.localeCompare(b.data) ||
            a.workerId.localeCompare(b.workerId),
      )
      const candidato = disponibili.shift()
      if (!candidato) break
      scelti.push(candidato)
      oreRimosse.set(
        candidato.workerId,
        (oreRimosse.get(candidato.workerId) ?? 0) + candidato.ore,
      )
    }
  }
  return scelti
}

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
  const dal = typeof r.dal === "string" ? r.dal : ""
  const al = typeof r.al === "string" ? r.al : ""
  const politica = r.politica === "concentrata" || r.politica === "distribuita" ? r.politica : null
  if (!politica) {
    return NextResponse.json({ errore: "Politica di riduzione non valida." }, { status: 400 })
  }

  try {
    validaIntervallo(dal, al)
    const dati = await caricaDatiSolver(dal, al)
    const modello = costruisciModello(dati)
    const sb = await creaClientServer()
    const mesi = mesiIntervallo(dal, al)
    const piani = await sb.from("schedules").select("id, mese, aggiornato_il").in("mese", mesi)
    if (piani.error) throw piani.error
    const scheduleIds = (piani.data ?? []).map((piano) => piano.id)
    if (scheduleIds.length === 0) {
      return NextResponse.json({ modifiche: [], oreTotali: 0, lavoratori: [], date: [] })
    }

    const assegnazioni = await sb
      .from("assignments")
      .select("data, worker_id, shift_type_id, position_id, bloccato")
      .in("schedule_id", scheduleIds)
      .gte("data", dal)
      .lte("data", al)
    if (assegnazioni.error) throw assegnazioni.error

    const richiesti = new Map<string, number>()
    for (const slot of modello.slots) {
      if (slot.data < dal || slot.data > al) continue
      const chiave = `${slot.data}:${slot.postazioneIdx}:${slot.turnoIdx}`
      richiesti.set(chiave, (richiesti.get(chiave) ?? 0) + 1)
    }
    const turni = new Map(
      dati.turni.map((turno) => [
        turno.id,
        {
          durata_min: turno.durata_min,
          peso_ore: turno.peso_ore,
          conta_nelle_ore: turno.conta_nelle_ore,
        },
      ]),
    )
    const gruppi = new Map<string, typeof assegnazioni.data>()
    for (const assegnazione of assegnazioni.data ?? []) {
      const postazioneIdx = dati.postazioni.findIndex((p) => p.id === assegnazione.position_id)
      const turnoIdx = dati.turni.findIndex((t) => t.id === assegnazione.shift_type_id)
      if (postazioneIdx < 0 || turnoIdx < 0) continue
      const chiave = `${assegnazione.data}:${postazioneIdx}:${turnoIdx}`
      const gruppo = gruppi.get(chiave) ?? []
      gruppo.push(assegnazione)
      gruppi.set(chiave, gruppo)
    }

    const candidati: Candidato[] = []
    for (const [chiave, gruppo] of gruppi) {
      const richiesto = richiesti.get(chiave)
      if (richiesto === undefined) continue
      const eccesso = Math.max(0, gruppo.length - richiesto)
      if (eccesso === 0) continue
      const selezionabili = gruppo.filter((assegnazione) => !assegnazione.bloccato)
      for (const assegnazione of selezionabili) {
        candidati.push({
          workerId: assegnazione.worker_id,
          data: assegnazione.data,
          shiftTypeId: null,
          positionId: null,
          ore: oreTurno(assegnazione.shift_type_id, turni),
          attualeShiftTypeId: assegnazione.shift_type_id,
          attualePositionId: assegnazione.position_id,
          gruppo: chiave,
          limiteGruppo: eccesso,
        })
      }
    }

    const selezionati = scegliCandidati(candidati, politica)
    const lavoratori = new Map<string, { ore: number; modifiche: number }>()
    for (const candidato of selezionati) {
      const voce = lavoratori.get(candidato.workerId) ?? { ore: 0, modifiche: 0 }
      voce.ore += candidato.ore
      voce.modifiche++
      lavoratori.set(candidato.workerId, voce)
    }
    const nomi = new Map(dati.lavoratori.map((lavoratore) => [lavoratore.id, `${lavoratore.nome} ${lavoratore.cognome}`]))

    return NextResponse.json({
      politica,
      modifiche: selezionati.map((candidato) => ({
        workerId: candidato.workerId,
        data: candidato.data,
        shiftTypeId: candidato.shiftTypeId,
        positionId: candidato.positionId,
      })),
      precondizioni: selezionati.map((candidato) => ({
        workerId: candidato.workerId,
        data: candidato.data,
        shiftTypeId: candidato.attualeShiftTypeId,
        positionId: candidato.attualePositionId,
      })),
      oreTotali: selezionati.reduce((totale, candidato) => totale + candidato.ore, 0),
      lavoratori: [...lavoratori].map(([workerId, valore]) => ({
        workerId,
        nome: nomi.get(workerId) ?? "Lavoratore",
        ...valore,
      })),
      date: [...new Set(selezionati.map((candidato) => candidato.data))].sort(),
      coperturaPreservata: true,
      versione: (piani.data ?? [])
        .map((piano) => `${piano.mese}:${piano.aggiornato_il}`)
        .sort()
        .join("|"),
    })
  } catch (errore) {
    console.error("Preview riduzione ore non riuscita", errore)
    return NextResponse.json(
      { errore: errore instanceof Error ? errore.message : "Preview non riuscita." },
      { status: 400 },
    )
  }
}
