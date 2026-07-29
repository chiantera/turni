import Link from "next/link"

import Navigazione from "@/app/componenti/Navigazione"
import { meseCorrente, nomeMese, spostaMese } from "@/lib/dati/formato"
import { creaClientServer, utenteCorrente } from "@/lib/supabase/server"

export const metadata = { title: "Riepilogo — Turni" }
export const dynamic = "force-dynamic"

export default async function Riepilogo() {
  const sb = await creaClientServer()
  const corrente = await utenteCorrente()
  const mese = meseCorrente()
  const prossimo = spostaMese(mese, 1)

  const [lavoratori, postazioni, turni, vincoli, piani] = await Promise.all([
    sb.from("workers").select("id", { count: "exact", head: true }).eq("attivo", true),
    sb.from("positions").select("id", { count: "exact", head: true }).eq("attiva", true),
    sb.from("shift_types").select("id", { count: "exact", head: true }).eq("attivo", true),
    sb.from("constraints").select("id", { count: "exact", head: true }).eq("attivo", true),
    sb.from("schedules").select("mese, stato, punteggio").in("mese", [mese, prossimo]),
  ])

  return (
    <>
      <Navigazione />
      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Riepilogo</h1>
          <p className="mt-1 text-sm text-tenue">
            Benvenuto{corrente?.profilo?.nome ? `, ${corrente.profilo.nome}` : ""}.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Riquadro etichetta="Lavoratori attivi" valore={lavoratori.count ?? 0} href="/lavoratori" />
          <Riquadro etichetta="Postazioni" valore={postazioni.count ?? 0} href="/postazioni" />
          <Riquadro etichetta="Tipi di turno" valore={turni.count ?? 0} href="/turni" />
          <Riquadro etichetta="Vincoli attivi" valore={vincoli.count ?? 0} href="/vincoli" />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <SchedaMese mese={mese} piani={piani.data ?? []} etichetta="Mese corrente" />
          <SchedaMese mese={prossimo} piani={piani.data ?? []} etichetta="Mese prossimo" />
        </section>
      </main>
    </>
  )
}

function Riquadro({
  etichetta,
  valore,
  href,
}: {
  etichetta: string
  valore: number
  href: string
}) {
  return (
    <Link href={href} className="scheda p-4 transition-colors hover:border-accento">
      <div className="text-sm text-tenue">{etichetta}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{valore}</div>
    </Link>
  )
}

function SchedaMese({
  mese,
  piani,
  etichetta,
}: {
  mese: string
  piani: { mese: string; stato: string; punteggio: unknown }[]
  etichetta: string
}) {
  const piano = piani.find((p) => p.mese === mese)
  const punteggio = piano?.punteggio as { scoperti?: number } | null

  return (
    <div className="scheda p-5">
      <div className="text-sm text-tenue">{etichetta}</div>
      <h2 className="mt-0.5 text-lg font-medium capitalize">{nomeMese(mese)}</h2>
      <p className="mt-3 text-sm">
        {!piano ? (
          <span className="text-tenue">Nessun piano ancora generato.</span>
        ) : punteggio?.scoperti ? (
          <span className="text-avviso">
            Piano in {piano.stato} con {punteggio.scoperti} turni scoperti.
          </span>
        ) : (
          <span className="text-accento">Piano in {piano.stato}, copertura completa.</span>
        )}
      </p>
      <Link href={`/pianificazione/${mese}`} className="bottone bottone-primario mt-4">
        {piano ? "Apri il piano" : "Genera il piano"}
      </Link>
    </div>
  )
}
