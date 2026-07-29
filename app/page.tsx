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

  const [lavoratori, postazioni, turni, piani, vincoli] = await Promise.all([
    sb.from("workers").select("id", { count: "exact", head: true }).eq("attivo", true),
    sb.from("positions").select("id", { count: "exact", head: true }).eq("attiva", true),
    sb.from("shift_types").select("*").eq("attivo", true).order("ordine_rotazione"),
    sb.from("schedules").select("*").order("mese", { ascending: false }).limit(6),
    sb.from("constraints").select("id", { count: "exact", head: true }).eq("attivo", true),
  ])

  const nLav = lavoratori.count ?? 0
  const nPost = postazioni.count ?? 0

  // Fabbisogno teorico secondo il ciclo canonico: 7 persone per postazione
  // coperta 24/7 con 2 mattini + 2 pomeriggi + 1 notte.
  const organicoTeorico = nPost * 7
  const scarto = nLav - organicoTeorico

  return (
    <>
      <Navigazione />
      <main className="flex-1 mx-auto w-full max-w-[1600px] p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Riepilogo</h1>
          <p className="text-sm text-tenue mt-1">
            Benvenuto{corrente?.profilo?.nome ? `, ${corrente.profilo.nome}` : ""}.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Riquadro etichetta="Lavoratori attivi" valore={nLav} href="/lavoratori" />
          <Riquadro etichetta="Postazioni" valore={nPost} href="/postazioni" />
          <Riquadro etichetta="Tipi di turno" valore={turni.data?.length ?? 0} href="/turni" />
          <Riquadro etichetta="Vincoli attivi" valore={vincoli.count ?? 0} href="/vincoli" />
        </section>

        {nPost > 0 && (
          <section className={`scheda p-5 ${scarto < 0 ? "border-avviso" : ""}`}>
            <h2 className="font-medium">Organico rispetto al ciclo di riferimento</h2>
            <p className="text-sm text-tenue mt-2 leading-relaxed">
              Il ciclo <strong>2 mattini + 2 pomeriggi + 1 notte</strong> vale 38 ore
              settimanali esatte con turni da 7h, 7h e 10h. Per coprire una postazione
              24 ore su 24 con 2 persone al mattino, 2 al pomeriggio e 1 di notte
              servono <strong>7 lavoratori</strong> sfasati di un giorno l&apos;uno
              dall&apos;altro.
            </p>
            <p className="mt-3 text-sm">
              {scarto >= 0 ? (
                <span className="text-accento">
                  {nLav} lavoratori per {nPost}{" "}
                  {nPost === 1 ? "postazione" : "postazioni"}: l&apos;organico è
                  sufficiente
                  {scarto > 0
                    ? ` con ${scarto} persone di margine.`
                    : ", senza margine per assenze impreviste."}
                </span>
              ) : (
                <span className="text-avviso">
                  {nLav} lavoratori per {nPost}{" "}
                  {nPost === 1 ? "postazione" : "postazioni"}: ne mancano circa{" "}
                  <strong>{-scarto}</strong>. I turni verranno generati comunque, ma
                  con buchi di copertura segnalati.
                </span>
              )}
            </p>
            <p className="mt-2 text-xs text-tenue">
              Stima indicativa: il calcolo esatto, che tiene conto della griglia di
              copertura reale e delle assenze, compare nella pagina di pianificazione
              prima di generare.
            </p>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <SchedaMese mese={mese} piani={piani.data ?? []} etichetta="Mese corrente" />
          <SchedaMese mese={prossimo} piani={piani.data ?? []} etichetta="Mese prossimo" />
        </section>

        {nLav === 0 && (
          <section className="scheda p-5">
            <h2 className="font-medium">Da dove iniziare</h2>
            <ol className="mt-3 space-y-2 text-sm list-decimal list-inside text-tenue">
              <li>
                Definisci le{" "}
                <Link href="/postazioni" className="underline text-testo">
                  postazioni
                </Link>{" "}
                da coprire.
              </li>
              <li>
                Controlla i{" "}
                <Link href="/turni" className="underline text-testo">
                  tipi di turno
                </Link>{" "}
                (mattino 7h, pomeriggio 7h, notte 10h).
              </li>
              <li>
                Imposta la{" "}
                <Link href="/copertura" className="underline text-testo">
                  copertura
                </Link>
                : quante persone servono per turno.
              </li>
              <li>
                Inserisci i{" "}
                <Link href="/lavoratori" className="underline text-testo">
                  lavoratori
                </Link>{" "}
                con le loro abilitazioni.
              </li>
              <li>
                Aggiungi i{" "}
                <Link href="/vincoli" className="underline text-testo">
                  vincoli
                </Link>{" "}
                scrivendoli in italiano.
              </li>
              <li>
                Genera il piano dalla pagina{" "}
                <Link href={`/pianificazione/${mese}`} className="underline text-testo">
                  pianificazione
                </Link>
                .
              </li>
            </ol>
          </section>
        )}
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
    <Link href={href} className="scheda p-4 hover:border-accento transition-colors">
      <div className="text-sm text-tenue">{etichetta}</div>
      <div className="text-3xl font-semibold mt-1 tabular-nums">{valore}</div>
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
      <h2 className="text-lg font-medium capitalize mt-0.5">{nomeMese(mese)}</h2>

      <p className="text-sm mt-3">
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
