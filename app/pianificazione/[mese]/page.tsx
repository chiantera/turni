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
import CalendarioMese from "./CalendarioMese"
import DecisioneOreEccedenti from "./DecisioneOreEccedenti"
import SelettoreIntervallo from "./SelettoreIntervallo"
import SuggerimentiAI from "./SuggerimentiAI"
import TabellaPianoInterattiva from "./TabellaPianoInterattiva"

type Assegnazione = Tables<"assignments">
type Violazione = Tables<"violations">

function evidenzaViolazione(violazione: Violazione): string | null {
  const riferimenti =
    violazione.riferimenti !== null &&
    typeof violazione.riferimenti === "object" &&
    !Array.isArray(violazione.riferimenti)
      ? (violazione.riferimenti as Record<string, unknown>)
      : null
  if (!riferimenti) return null

  if (
    violazione.tipo === "capacita_eccedente" &&
    typeof riferimenti.oreEccedenti === "number"
  ) {
    return `Evidenza solver: la copertura è completa; restano circa ${riferimenti.oreEccedenti.toFixed(1)} ore contrattuali oltre ai turni richiesti.`
  }

  const blocker = riferimenti.blocker
  if (!Array.isArray(blocker) || blocker.length === 0) return null
  const etichette: Record<string, string> = {
    assenza: "assenze",
    assenza_turno: "assenze per turno",
    abilitazione_mancante: "abilitazioni mancanti",
    max_ore_settimana: "tetto ore settimanale",
    max_turni: "limite di turni",
    riposo_insufficiente: "riposo minimo",
    riposo_minimo: "riposo minimo",
    riposo_dopo_notte: "riposo dopo notte",
    giorni_consecutivi: "giorni consecutivi",
    postazione_vietata: "postazione vietata",
    turno_vietato: "turno vietato",
    turno_gia_assegnato: "turno già assegnato",
    separati: "vincolo di separazione",
  }
  const conteggi = new Map<string, number>()
  for (const voce of blocker) {
    if (!voce || typeof voce !== "object" || !("codice" in voce)) continue
    const nome =
      etichette[String(voce.codice)] ?? "altre cause di assegnabilità"
    const conteggio =
      "conteggio" in voce && typeof voce.conteggio === "number"
        ? voce.conteggio
        : 1
    conteggi.set(nome, (conteggi.get(nome) ?? 0) + conteggio)
  }
  const nomi = [...conteggi].map(([nome, conteggio]) =>
    conteggio > 1 ? `${nome} (${conteggio})` : nome,
  )
  return nomi.length > 0 ? `Cause esaminate: ${nomi.join(", ")}.` : null
}

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
  const planningRun = await sb
    .from("planning_runs")
    .select("id, versione")
    .eq("dal", dal)
    .eq("al", al)
    .maybeSingle()
  if (planningRun.error) throw planningRun.error
  const pianiQuery = planningRun.data
    ? sb.from("schedules").select("*").eq("planning_run_id", planningRun.data.id).order("mese")
    : Promise.resolve({ data: [], error: null })
  const [piani, lavoratori, postazioni, turni, festivita, abilitazioni, assenze] =
    await Promise.all([
      pianiQuery,
      sb.from("workers").select("*").eq("attivo", true).order("cognome"),
      sb.from("positions").select("*").eq("attiva", true).order("ordine"),
      sb
        .from("shift_types")
        .select("*")
        .eq("attivo", true)
        .order("ordine_rotazione"),
      sb.from("holidays").select("*").gte("data", dal).lte("data", al),
      sb.from("worker_positions").select("*"),
      sb
        .from("absences")
        .select("*")
        .lte("dal", al)
        .gte("al", dal)
        .order("dal"),
    ])

  for (const risultato of [
    piani,
    lavoratori,
    postazioni,
    turni,
    festivita,
    abilitazioni,
    assenze,
  ]) {
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
  const capacitaEccedente = violazioni.find((v) => v.tipo === "capacita_eccedente")
  const riferimentiCapacita = capacitaEccedente?.riferimenti
  const oreEccedenti =
    riferimentiCapacita !== null &&
    typeof riferimentiCapacita === "object" &&
    !Array.isArray(riferimentiCapacita) &&
    typeof riferimentiCapacita.oreEccedenti === "number"
      ? riferimentiCapacita.oreEccedenti
      : null
  const meseCompleto =
    mesi.length === 1 && dal === mesi[0] && al === fineDelMese(dal)
  const titolo = meseCompleto
    ? nomeMese(dal)
    : `${dataEstesa(dal)} – ${dataEstesa(al)}`
  const haPiano = (piani.data ?? []).length > 0
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
          </div>
          <div className="no-stampa flex items-center gap-2 text-sm">
            {meseCompleto && (
              <Link
                href={`/pianificazione/${spostaMese(mese, -1)}`}
                className="bottone py-1"
              >
                ← precedente
              </Link>
            )}
            <CalendarioMese key={mese} mese={mese} />
            {meseCompleto && (
              <Link
                href={`/pianificazione/${spostaMese(mese, 1)}`}
                className="bottone py-1"
              >
                successivo →
              </Link>
            )}
          </div>
        </div>

        <details className="no-stampa rounded-xl border border-bordo bg-superficie" open={!haPiano}>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium hover:bg-accento-tenue [&::-webkit-details-marker]:hidden">
            <span className="mr-2 text-accento">☰</span>
            Menu pianificazione
            <span className="ml-2 text-xs font-normal text-tenue">strumenti, viste e segnalazioni</span>
          </summary>
          <div className="space-y-4 border-t border-bordo p-4">
            <SelettoreIntervallo key={`${dal}:${al}`} dal={dal} al={al} />
            <BarraAzioni dal={dal} al={al} esistente={haPiano} />
            {haPiano && oreEccedenti !== null && oreEccedenti > 0 && (
              <DecisioneOreEccedenti
                dal={dal}
                al={al}
                oreEccedenti={oreEccedenti}
                numeroLavoratori={lavoratori.data?.length ?? 0}
              />
            )}

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
                  (() => {
                    const evidenza = evidenzaViolazione(violazione)
                    return <li
                    key={violazione.id}
                    className="rounded-lg bg-allarme-tenue px-3 py-2 text-sm text-allarme"
                  >
                    {violazione.messaggio}
                    {evidenza && (
                      <p className="mt-1 text-xs text-current/80">
                        {evidenza}
                      </p>
                    )}
                    <SuggerimentiAI
                      dal={dal}
                      al={al}
                      segnalazioneId={violazione.id}
                    />
                  </li>
                  })()
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
                    (() => {
                      const evidenza = evidenzaViolazione(violazione)
                      return <li key={violazione.id} className="px-3 py-1.5 text-sm text-tenue">
                      {violazione.messaggio}
                      {evidenza && (
                        <p className="mt-1 text-xs text-current/80">
                          {evidenza}
                        </p>
                      )}
                      <SuggerimentiAI
                        dal={dal}
                        al={al}
                        segnalazioneId={violazione.id}
                      />
                    </li>
                    })()
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
          </div>
        </details>

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
            assenze={assenze.data ?? []}
          />
        )}
      </main>
    </>
  )
}
