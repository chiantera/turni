import Link from "next/link"

import Navigazione from "@/app/componenti/Navigazione"
import BarraAzioni from "./BarraAzioni"
import SuggerimentiAI from "./SuggerimentiAI"
import TabellaPianoInterattiva from "./TabellaPianoInterattiva"
import {
  GIORNI_BREVI,
  nomeMese,
  ore,
  spostaMese,
} from "@/lib/dati/formato"
import { giorniNelMese, giornoSettimana, primoDelMese } from "@/lib/solver/tempo"
import type { Tables } from "@/lib/supabase/types"
import { creaClientServer } from "@/lib/supabase/server"

type Assegnazione = Tables<"assignments">
type Violazione = Tables<"violations">

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mese: string }>
}) {
  const { mese } = await params
  return { title: `${nomeMese(mese)} — Turni` }
}

export default async function Pianificazione({
  params,
  searchParams,
}: {
  params: Promise<{ mese: string }>
  searchParams: Promise<{ vista?: string }>
}) {
  const { mese: meseGrezzo } = await params
  const { vista: vistaGrezza } = await searchParams
  const mese = primoDelMese(meseGrezzo)
  const vista = vistaGrezza === "postazione" ? "postazione" : "lavoratore"
  const tabellaEditabile = new Set(["lavoratore", "postazione"]).has(vista)

  const sb = await creaClientServer()
  const nGiorni = giorniNelMese(mese)
  const giorni = Array.from(
    { length: nGiorni },
    (_, i) => `${mese.slice(0, 8)}${String(i + 1).padStart(2, "0")}`,
  )
  const fine = giorni[giorni.length - 1]

  const [piano, lavoratori, postazioni, turni, festivita, abilitazioni] = await Promise.all([
    sb.from("schedules").select("*").eq("mese", mese).maybeSingle(),
    sb.from("workers").select("*").eq("attivo", true).order("cognome"),
    sb.from("positions").select("*").eq("attiva", true).order("ordine"),
    sb.from("shift_types").select("*").eq("attivo", true).order("ordine_rotazione"),
    sb.from("holidays").select("*").gte("data", mese).lte("data", fine),
    sb.from("worker_positions").select("*"),
  ])

  const risultati = piano.data
    ? await Promise.all([
        sb.from("assignments").select("*").eq("schedule_id", piano.data.id),
        sb
          .from("violations")
          .select("*")
          .eq("schedule_id", piano.data.id)
          .order("gravita"),
      ])
    : null

  const assegnazioni: Assegnazione[] = risultati?.[0].data ?? []
  const violazioni: Violazione[] = risultati?.[1].data ?? []

  const turniPerId = new Map((turni.data ?? []).map((t) => [t.id, t]))
  const postPerId = new Map((postazioni.data ?? []).map((p) => [p.id, p]))
  const lavPerId = new Map((lavoratori.data ?? []).map((l) => [l.id, l]))
  const festiviSet = new Set((festivita.data ?? []).map((f) => f.data))

  // Indici per il rendering della griglia
  const perLavoratoreGiorno = new Map<string, Assegnazione>()
  const perPostTurnoGiorno = new Map<string, string[]>()
  for (const a of assegnazioni) {
    perLavoratoreGiorno.set(`${a.worker_id}:${a.data}`, a)
    const k = `${a.position_id}:${a.shift_type_id}:${a.data}`
    const v = perPostTurnoGiorno.get(k) ?? []
    v.push(a.worker_id)
    perPostTurnoGiorno.set(k, v)
  }

  const oreLav = new Map<string, number>()
  const nottiLav = new Map<string, number>()
  for (const a of assegnazioni) {
    const t = turniPerId.get(a.shift_type_id)
    if (!t) continue
    if (t.conta_nelle_ore) {
      oreLav.set(
        a.worker_id,
        (oreLav.get(a.worker_id) ?? 0) + (t.durata_min * Number(t.peso_ore)) / 60,
      )
    }
    if (t.is_notte) nottiLav.set(a.worker_id, (nottiLav.get(a.worker_id) ?? 0) + 1)
  }


  const bloccanti = violazioni.filter((v) => v.gravita === "bloccante")
  const altre = violazioni.filter((v) => v.gravita !== "bloccante")

  return (
    <>
      <Navigazione />
      <main className="flex-1 mx-auto w-full max-w-[1600px] p-4 sm:p-6 space-y-5">
        {/* --- Intestazione --- */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold capitalize">{nomeMese(mese)}</h1>
            <p className="text-sm text-tenue mt-1">
              {piano.data
                ? `Piano in ${piano.data.stato} · ${assegnazioni.length} turni assegnati`
                : "Nessun piano generato per questo mese."}
            </p>
          </div>
          <div className="no-stampa flex items-center gap-2 text-sm">
            <Link href={`/pianificazione/${spostaMese(mese, -1)}`} className="bottone py-1">
              ← precedente
            </Link>
            <Link href={`/pianificazione/${spostaMese(mese, 1)}`} className="bottone py-1">
              successivo →
            </Link>
          </div>
        </div>

        <BarraAzioni mese={mese} esistente={Boolean(piano.data)} />

        {/* --- Segnalazioni --- */}
        {(bloccanti.length > 0 || altre.length > 0) && (
          <section className="scheda p-4 space-y-3">
            <h2 className="font-medium">
              Segnalazioni
              {bloccanti.length > 0 && (
                <span className="ml-2 text-sm text-allarme">
                  {bloccanti.length} da risolvere
                </span>
              )}
            </h2>

            {bloccanti.length > 0 && (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                {bloccanti.map((v) => (
                  <li
                    key={v.id}
                    className="text-sm rounded-lg bg-allarme-tenue text-allarme px-3 py-2"
                  >
                    {v.messaggio}
                  </li>
                ))}
              </ul>
            )}

            {altre.length > 0 && (
              <details>
                <summary className="text-sm text-tenue cursor-pointer">
                  {altre.length} avvisi minori
                </summary>
                <ul className="mt-2 space-y-1.5 max-h-56 overflow-y-auto">
                  {altre.map((v) => (
                    <li key={v.id} className="text-sm text-tenue px-3 py-1.5">
                      {v.messaggio}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <SuggerimentiAI
              mese={mese}
              numeroSegnalazioni={violazioni.length}
            />
          </section>
        )}

        {/* --- Griglia --- */}
        {!piano.data ? (
          <div className="scheda p-8 text-center text-tenue">
            Nessun turno da mostrare. Usa <strong>Genera il piano</strong> qui sopra.
          </div>
        ) : tabellaEditabile ? (
          <TabellaPianoInterattiva
            mese={mese}
            vista={vista}
            giorni={giorni}
            festivi={[...festiviSet]}
            lavoratori={lavoratori.data ?? []}
            turni={turni.data ?? []}
            postazioni={postazioni.data ?? []}
            abilitazioni={abilitazioni.data ?? []}
            assegnazioni={assegnazioni}
          />
        ) : (
          <section className="scheda overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-superficie text-left font-medium px-3 py-2 border-b border-r border-bordo min-w-44">
                    {vista === "lavoratore" ? "Lavoratore" : "Postazione / turno"}
                  </th>
                  {giorni.map((g) => {
                    const dow = giornoSettimana(g)
                    const speciale = dow === 0 || dow === 6 || festiviSet.has(g)
                    return (
                      <th
                        key={g}
                        className={`px-1 py-1 border-b border-bordo text-center font-normal min-w-9 ${
                          speciale ? "bg-avviso-tenue" : ""
                        }`}
                        title={festiviSet.has(g) ? "Festivo" : undefined}
                      >
                        <div className="text-[10px] text-tenue">{GIORNI_BREVI[dow]}</div>
                        <div className="tabular-nums">{Number(g.slice(8, 10))}</div>
                      </th>
                    )
                  })}
                  {vista === "lavoratore" && (
                    <>
                      <th className="px-2 py-2 border-b border-l border-bordo text-right font-medium">
                        Ore
                      </th>
                      <th className="px-2 py-2 border-b border-bordo text-right font-medium">
                        Notti
                      </th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody>
                {vista === "lavoratore"
                  ? (lavoratori.data ?? []).map((l) => {
                      const oreTotali = oreLav.get(l.id) ?? 0
                      const target = (Number(l.ore_settimanali) * nGiorni) / 7
                      const scarto = oreTotali - target
                      return (
                        <tr key={l.id} className="hover:bg-accento-tenue/40">
                          <td className="sticky left-0 z-10 bg-superficie px-3 py-1.5 border-b border-r border-bordo whitespace-nowrap">
                            {l.cognome} {l.nome}
                          </td>
                          {giorni.map((g) => {
                            const a = perLavoratoreGiorno.get(`${l.id}:${g}`)
                            const t = a ? turniPerId.get(a.shift_type_id) : null
                            const p = a ? postPerId.get(a.position_id) : null
                            const dow = giornoSettimana(g)
                            const speciale = dow === 0 || dow === 6 || festiviSet.has(g)
                            return (
                              <td
                                key={g}
                                className={`border-b border-bordo text-center p-0.5 ${
                                  speciale && !t ? "bg-avviso-tenue/40" : ""
                                }`}
                                title={
                                  t
                                    ? `${t.nome} · ${p?.nome ?? ""} · ${t.ora_inizio.slice(0, 5)}-${t.ora_fine.slice(0, 5)}`
                                    : "Riposo"
                                }
                              >
                                {t ? (
                                  <span
                                    className="inline-block w-6 h-6 leading-6 rounded font-medium text-white text-xs"
                                    style={{ backgroundColor: p?.colore }}
                                  >
                                    {t.codice}
                                  </span>
                                ) : (
                                  <span className="text-bordo">·</span>
                                )}
                              </td>
                            )
                          })}
                          <td
                            className={`px-2 border-b border-l border-bordo text-right tabular-nums ${
                              Math.abs(scarto) > 8 ? "text-avviso font-medium" : ""
                            }`}
                            title={`Obiettivo ${ore(target)}`}
                          >
                            {ore(oreTotali)}
                          </td>
                          <td className="px-2 border-b border-bordo text-right tabular-nums">
                            {nottiLav.get(l.id) ?? 0}
                          </td>
                        </tr>
                      )
                    })
                  : (postazioni.data ?? []).flatMap((p) =>
                      (turni.data ?? []).map((t) => (
                        <tr key={`${p.id}:${t.id}`} className="hover:bg-accento-tenue/40">
                          <td className="sticky left-0 z-10 bg-superficie px-3 py-1.5 border-b border-r border-bordo whitespace-nowrap">
                            <span
                              className="mr-2 inline-block h-5 w-5 rounded text-center text-[10px] font-medium leading-5 text-white align-middle"
                              style={{ backgroundColor: p.colore }}
                            >
                              {t.codice}
                            </span>
                            {p.nome}
                            <span className="text-tenue"> · {t.nome}</span>
                          </td>
                          {giorni.map((g) => {
                            const ids = perPostTurnoGiorno.get(`${p.id}:${t.id}:${g}`) ?? []
                            const dow = giornoSettimana(g)
                            const speciale = dow === 0 || dow === 6 || festiviSet.has(g)
                            return (
                              <td
                                key={g}
                                className={`border-b border-bordo text-center text-[10px] leading-tight p-0.5 ${
                                  speciale ? "bg-avviso-tenue/40" : ""
                                }`}
                                title={ids
                                  .map((i) => {
                                    const l = lavPerId.get(i)
                                    return l ? `${l.nome} ${l.cognome}` : i
                                  })
                                  .join(", ")}
                              >
                                {ids.length === 0 ? (
                                  <span className="text-allarme font-bold">—</span>
                                ) : (
                                  ids.map((i) => {
                                    const l = lavPerId.get(i)
                                    return (
                                      <div key={i} className="truncate max-w-16">
                                        {l ? l.cognome : "?"}
                                      </div>
                                    )
                                  })
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )),
                    )}
              </tbody>
            </table>
          </section>
        )}

      </main>
    </>
  )
}
