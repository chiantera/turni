import ExcelJS from "exceljs"
import { NextResponse } from "next/server"

import { GIORNI_BREVI, nomeMese } from "@/lib/dati/formato"
import { giorniNelMese, giornoSettimana, primoDelMese } from "@/lib/solver/tempo"
import { creaClientServer, ePianificatore } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/types"

export const runtime = "nodejs"

/**
 * Esporta il tabellone in Excel.
 *
 * Due fogli: "Turni" nel formato che i pianificatori già conoscono (una riga
 * per persona, una colonna per giorno) e "Riepilogo" con ore e notti, che è
 * quello che finisce in amministrazione.
 */
export async function GET(req: Request) {
  if (!(await ePianificatore())) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 })
  }

  const meseGrezzo = new URL(req.url).searchParams.get("mese")
  if (!meseGrezzo || !/^\d{4}-\d{2}-\d{2}$/.test(meseGrezzo)) {
    return NextResponse.json({ errore: "Parametro 'mese' mancante." }, { status: 400 })
  }
  const mese = primoDelMese(meseGrezzo)
  const nGiorni = giorniNelMese(mese)
  const giorni = Array.from(
    { length: nGiorni },
    (_, i) => `${mese.slice(0, 8)}${String(i + 1).padStart(2, "0")}`,
  )

  const sb = await creaClientServer()
  const piano = await sb.from("schedules").select("*").eq("mese", mese).maybeSingle()
  if (!piano.data) {
    return NextResponse.json({ errore: "Nessun piano per questo mese." }, { status: 404 })
  }

  const [lavoratori, turni, postazioni, assegnazioni, festivita] = await Promise.all([
    sb.from("workers").select("*").eq("attivo", true).order("cognome"),
    sb.from("shift_types").select("*"),
    sb.from("positions").select("*"),
    sb.from("assignments").select("*").eq("schedule_id", piano.data.id),
    sb.from("holidays").select("data").gte("data", mese).lte("data", giorni[nGiorni - 1]),
  ])

  const turnoPerId = new Map((turni.data ?? []).map((t) => [t.id, t]))
  const postPerId = new Map((postazioni.data ?? []).map((p) => [p.id, p]))
  const festivi = new Set((festivita.data ?? []).map((f) => f.data))

  const perLavGiorno = new Map<string, Tables<"assignments">>()
  for (const a of assegnazioni.data ?? []) {
    perLavGiorno.set(`${a.worker_id}:${a.data}`, a)
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = "Turni"
  wb.created = new Date()

  // --- Foglio 1: il tabellone --------------------------------------------
  const f1 = wb.addWorksheet(`Turni ${nomeMese(mese)}`, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 2 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  })

  f1.getRow(1).values = ["", ...giorni.map((g) => GIORNI_BREVI[giornoSettimana(g)])]
  f1.getRow(2).values = ["Lavoratore", ...giorni.map((g) => Number(g.slice(8, 10)))]
  f1.getRow(1).font = { size: 9, color: { argb: "FF64748B" } }
  f1.getRow(2).font = { bold: true }
  f1.getColumn(1).width = 26
  for (let i = 2; i <= nGiorni + 1; i++) f1.getColumn(i).width = 4.5

  // Evidenzia weekend e festivi anche nell'export: chi legge il foglio deve
  // riconoscerli senza dover ricontare i giorni.
  giorni.forEach((g, i) => {
    const dow = giornoSettimana(g)
    if (dow === 0 || dow === 6 || festivi.has(g)) {
      for (const r of [1, 2]) {
        f1.getRow(r).getCell(i + 2).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFEF3C7" },
        }
      }
    }
  })

  ;(lavoratori.data ?? []).forEach((l, idx) => {
    const riga = f1.getRow(idx + 3)
    riga.getCell(1).value = `${l.cognome} ${l.nome}`
    giorni.forEach((g, i) => {
      const a = perLavGiorno.get(`${l.id}:${g}`)
      const cella = riga.getCell(i + 2)
      if (a) {
        const t = turnoPerId.get(a.shift_type_id)
        cella.value = t?.codice ?? "?"
        cella.alignment = { horizontal: "center" }
        cella.font = { bold: true, color: { argb: "FFFFFFFF" } }
        cella.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${(t?.colore ?? "#64748b").replace("#", "").toUpperCase()}` },
        }
        const p = postPerId.get(a.position_id)
        cella.note = `${t?.nome ?? ""}${p ? ` — ${p.nome}` : ""}`
      } else {
        const dow = giornoSettimana(g)
        if (dow === 0 || dow === 6 || festivi.has(g)) {
          cella.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF9E7" },
          }
        }
      }
    })
  })

  // --- Foglio 2: riepilogo ore -------------------------------------------
  const f2 = wb.addWorksheet("Riepilogo")
  f2.columns = [
    { header: "Lavoratore", key: "nome", width: 26 },
    { header: "Ore svolte", key: "ore", width: 12 },
    { header: "Ore contratto", key: "target", width: 14 },
    { header: "Scarto", key: "scarto", width: 10 },
    { header: "Giorni lavorati", key: "giorni", width: 15 },
    { header: "Notti", key: "notti", width: 8 },
    { header: "Festivi/weekend", key: "festivi", width: 16 },
  ]
  f2.getRow(1).font = { bold: true }

  for (const l of lavoratori.data ?? []) {
    let minuti = 0
    let notti = 0
    let festiviLav = 0
    let giorniLav = 0
    for (const g of giorni) {
      const a = perLavGiorno.get(`${l.id}:${g}`)
      if (!a) continue
      const t = turnoPerId.get(a.shift_type_id)
      if (!t) continue
      giorniLav++
      if (t.conta_nelle_ore) minuti += t.durata_min * Number(t.peso_ore)
      if (t.is_notte) notti++
      const dow = giornoSettimana(g)
      if (dow === 0 || dow === 6 || festivi.has(g)) festiviLav++
    }
    const ore = minuti / 60
    const target = (Number(l.ore_settimanali) * nGiorni) / 7
    f2.addRow({
      nome: `${l.cognome} ${l.nome}`,
      ore: Math.round(ore * 10) / 10,
      target: Math.round(target * 10) / 10,
      scarto: Math.round((ore - target) * 10) / 10,
      giorni: giorniLav,
      notti,
      festivi: festiviLav,
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="turni-${mese.slice(0, 7)}.xlsx"`,
    },
  })
}
