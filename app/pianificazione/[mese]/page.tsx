import Link from "next/link"
import { redirect } from "next/navigation"

import Navigazione from "@/app/componenti/Navigazione"
import {
  dataEstesa,
  nomeMese,
  spostaMese,
} from "@/lib/dati/formato"
import {
  fineDelMese,
  giorniIntervallo,
  intervalloDaParametri,
  mesiIntervallo,
  segnalazioneRilevante,
} from "@/lib/dati/intervallo"
import { primoDelMese } from "@/lib/solver/tempo"
import { creaClientServer } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/types"
import BarraAzioni from "./BarraAzioni"
import SelettoreIntervallo from "./SelettoreIntervallo"
import SuggerimentiAI from "./SuggerimentiAI"
import TabellaPianoInterattiva from "./TabellaPianoInterattiva"

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
  searchParams: Promise<{ vista?: string; dal?: string; al?: string }>
}) {
  const { mese: meseGrezzo } = await params
  const parametri = await searchParams
  const mese = primoDelMese(meseGrezzo)
  let intervallo
  try {
    intervallo = intervalloDaParametri({
      mese,
      dal: parametri.dal,
      al: parametri.al,
    })
  } catch {
    redirect(`/pianificazione/${mese}`)
  }
  const { dal, al } = intervallo
  const vista = parametri.vista === "postazione" ? "postazione" : "lavoratore"
  const giorni = giorniIntervallo(dal, al)
  const mesi = mesiIntervallo(dal, al)

  const sb = await creaClientServer()
  const [piani, lavoratori, postazioni, turni, festivita, abilitazioni] =
    await Promise.all([
      sb.from("schedules").select("*").in("mese", mesi).order("mese"),
      sb.from("workers").select("*").eq("attivo", true).order("cognome"),
      sb.from("positions").select("*").eq("attiva", true).order("ordine"),
      sb
        .from("shift_types")
        .select("*")
        .eq("attivo", true)
        .order("ordine_rotazione"),
      sb.from("holidays").select("*").gte("data", dal).lte("data", al),
      sb.from("worker_positions").select("*"),
    ])

  for (const risultato of [piani, lavoratori, postazioni, turni, festivita, abilitazioni]) {
    if (risultato.error) throw risultato.error
  }

  const scheduleIds = (piani.data ?? []).map((piano) => piano.id)
  let assegnazioni: Assegnazione[] = []
  let violazioni: Violazione[] = []
  if (scheduleIds.length > 0) {
    const [assegnazioniDb, violazioniDb] = await Promise.all([
      sb
        .from("assignments")
        .select("*")
        .in("schedule_id", scheduleIds)
        .gte("data", dal)
        .lte("data", al),
      sb
        .from("violations")
        .select("*")
        .in("schedule_id", scheduleIds)
        .order("gravita"),
    ])
    if (assegnazioniDb.error) throw assegnazioniDb.error
    if (violazioniDb.error) throw violazioniDb.error
    assegnazioni = assegnazioniDb.data ?? []
    violazioni = (violazioniDb.data ?? []).filter(
      (violazione) =>
        segnalazioneRilevante(
          violazione.data,
          violazione.riferimenti,
          dal,
          al,
        ),
    )
  }

  const festivi = (festivita.data ?? []).map((f) => f.data)
  const bloccanti = violazioni.filter((v) => v.gravita === "bloccante")
  const altre = violazioni.filter((v) => v.gravita !== "bloccante")
  const meseCompleto =
    mesi.length === 1 && dal === mesi[0] && al === fineDelMese(dal)
  const titolo = meseCompleto
    ? nomeMese(dal)
    : `${dataEstesa(dal)} – ${dataEstesa(al)}`
  const haPiano = (piani.data ?? []).length > 0
  const mesiMancanti = mesi.filter(
    (meseIntervallo) => !(piani.data ?? []).some((piano) => piano.mese === meseIntervallo),
  )
  const versionePiano = (piani.data ?? [])
    .map((piano) => `${piano.id}:${piano.aggiornato_il}`)
    .join("|")

  return (
    <>
      <Navigazione />
      <main className="mx-auto flex-1 w-full max-w-[1600px] space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold capitalize">{titolo}</h1>
            <p className="mt-1 text-sm text-tenue">
              {haPiano
                ? `${assegnazioni.length} turni assegnati nell’intervallo selezionato${mesiMancanti.length > 0 ? ` · ${mesiMancanti.length} ${mesiMancanti.length === 1 ? "mese da generare" : "mesi da generare"}` : ""}`
                : "Nessun piano generato per questo intervallo."}
            </p>
          </div>
          {meseCompleto && (
            <div className="no-stampa flex items-center gap-2 text-sm">
              <Link
                href={`/pianificazione/${spostaMese(mese, -1)}`}
                className="bottone py-1"
              >
                ← precedente
              </Link>
              <Link
                href={`/pianificazione/${spostaMese(mese, 1)}`}
                className="bottone py-1"
              >
                successivo →
              </Link>
            </div>
          )}
        </div>

        <SelettoreIntervallo key={`${dal}:${al}`} dal={dal} al={al} />
        <BarraAzioni dal={dal} al={al} esistente={haPiano} />

        {(bloccanti.length > 0 || altre.length > 0) && (
          <section className="scheda space-y-3 p-4">
            <h2 className="font-medium">
              Segnalazioni
              {bloccanti.length > 0 && (
                <span className="ml-2 text-sm text-allarme">
                  {bloccanti.length} da risolvere
                </span>
              )}
            </h2>

            {bloccanti.length > 0 && (
              <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {bloccanti.map((violazione) => (
                  <li
                    key={violazione.id}
                    className="rounded-lg bg-allarme-tenue px-3 py-2 text-sm text-allarme"
                  >
                    {violazione.messaggio}
                  </li>
                ))}
              </ul>
            )}

            {altre.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm text-tenue">
                  {altre.length} avvisi minori
                </summary>
                <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
                  {altre.map((violazione) => (
                    <li key={violazione.id} className="px-3 py-1.5 text-sm text-tenue">
                      {violazione.messaggio}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <SuggerimentiAI
              dal={dal}
              al={al}
              numeroSegnalazioni={violazioni.length}
            />
          </section>
        )}

        {!haPiano ? (
          <div className="scheda p-8 text-center text-tenue">
            Nessun turno da mostrare. Usa <strong>Genera il piano</strong> qui sopra.
          </div>
        ) : (
          <TabellaPianoInterattiva
            key={`${dal}:${al}:${versionePiano}`}
            dal={dal}
            al={al}
            vista={vista}
            giorni={giorni}
            festivi={festivi}
            lavoratori={lavoratori.data ?? []}
            turni={turni.data ?? []}
            postazioni={postazioni.data ?? []}
            abilitazioni={abilitazioni.data ?? []}
            assegnazioni={assegnazioni}
          />
        )}
      </main>
    </>
  )
}
