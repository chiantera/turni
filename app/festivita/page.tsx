import { revalidatePath } from "next/cache"

import BottoneConferma from "@/app/componenti/BottoneConferma"
import Navigazione from "@/app/componenti/Navigazione"
import { GIORNI, dataEstesa } from "@/lib/dati/formato"
import { giornoSettimana } from "@/lib/solver/tempo"
import { creaClientServer } from "@/lib/supabase/server"

export const metadata = { title: "Festività — Turni" }
export const dynamic = "force-dynamic"

/**
 * Il calendario delle festività.
 *
 * Una data qui dentro fa **due** cose distinte, e confonderle porta a
 * configurare la copertura sbagliata:
 *
 *  1. conta come festivo lavorato per chi ci lavora — sempre, qualunque sia il
 *     flag (`vincoli.ts`, nell'equità e nel riepilogo);
 *  2. fa passare la copertura alla regola `festivo` di ogni postazione — solo
 *     se `usa_copertura_festiva`, e solo dove quella regola esiste.
 *
 * Le domeniche sono già festive per il punto 1 senza stare in tabella.
 */

async function aggiungi(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  await sb.from("holidays").insert({
    data: String(formData.get("data")),
    nome: String(formData.get("nome") ?? "").trim(),
    nazionale: formData.get("nazionale") === "si",
    usa_copertura_festiva: formData.get("copertura") === "si",
  })
  revalidatePath("/festivita")
  revalidatePath("/pianificazione/[mese]", "page")
}

async function elimina(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  await sb.from("holidays").delete().eq("data", String(formData.get("data")))
  revalidatePath("/festivita")
  revalidatePath("/pianificazione/[mese]", "page")
}

async function cambiaCopertura(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  await sb
    .from("holidays")
    .update({ usa_copertura_festiva: formData.get("copertura") === "si" })
    .eq("data", String(formData.get("data")))
  revalidatePath("/festivita")
  revalidatePath("/pianificazione/[mese]", "page")
}

function riga(f: {
  data: string
  nome: string
  nazionale: boolean
  usa_copertura_festiva: boolean
}) {
  const dow = giornoSettimana(f.data)
  return (
    <div
      key={f.data}
      className="scheda flex flex-wrap items-center gap-3 p-3 sm:p-4"
    >
      <div className="min-w-[15rem] flex-1">
        <div className="font-medium">
          {f.nome}
          {!f.nazionale && (
            <span className="ml-2 rounded bg-accento-tenue px-1.5 py-0.5 text-xs font-normal text-accento">
              locale
            </span>
          )}
        </div>
        <div className="text-sm text-tenue">
          {GIORNI[dow]} {dataEstesa(f.data)}
          {dow === 0 && " · di domenica, quindi già festiva di suo"}
        </div>
      </div>

      <form action={cambiaCopertura}>
        <input type="hidden" name="data" value={f.data} />
        <input
          type="hidden"
          name="copertura"
          value={f.usa_copertura_festiva ? "no" : "si"}
        />
        <button type="submit" className="bottone text-sm">
          {f.usa_copertura_festiva
            ? "Usa la copertura festiva"
            : "Copertura come un giorno normale"}
        </button>
      </form>

      <form action={elimina}>
        <input type="hidden" name="data" value={f.data} />
        <BottoneConferma etichetta="Elimina" conferma="Confermi?" />
      </form>
    </div>
  )
}

export default async function Festivita() {
  const sb = await creaClientServer()
  const { data } = await sb.from("holidays").select("*").order("data")
  const tutte = data ?? []

  // "Oggi" a Roma, in ISO, per separare ciò che deve ancora arrivare.
  const oggi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(
    new Date(),
  )
  const future = tutte.filter((f) => f.data >= oggi)
  const passate = tutte.filter((f) => f.data < oggi).reverse()

  return (
    <>
      <Navigazione />
      <main className="flex-1 mx-auto w-full max-w-4xl p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Festività</h1>
          <p className="mt-1 text-sm text-tenue">
            Oltre a quelle nazionali puoi aggiungere le date che valgono solo
            qui, come il santo patrono del paese.
          </p>
        </div>

        <div className="scheda p-4 text-sm space-y-2">
          <p className="font-medium">Una data qui fa due cose diverse.</p>
          <p className="text-tenue">
            <strong className="font-medium text-testo">Conta come festivo</strong>{" "}
            per chi ci lavora: entra nel riepilogo di ognuno e il solver cerca di
            distribuire i festivi in modo equo. Succede sempre, per ogni data in
            elenco. Le domeniche lo sono già senza doverle aggiungere.
          </p>
          <p className="text-tenue">
            <strong className="font-medium text-testo">
              Cambia la copertura richiesta
            </strong>{" "}
            solo se lasci attiva «usa la copertura festiva», e solo per le
            postazioni che hanno una regola festiva in{" "}
            <a href="/copertura" className="underline">
              Copertura
            </a>
            . Stradora non ne ha, ed è giusto così: è residenziale e si presidia
            a Natale come in un martedì qualunque. Il Bruco ne ha una a zero,
            perché chiude.
          </p>
        </div>

        <form
          action={aggiungi}
          className="scheda grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto]"
        >
          <div>
            <label htmlFor="data" className="text-sm font-medium">
              Data
            </label>
            <input id="data" name="data" type="date" className="campo mt-1" required />
          </div>
          <div>
            <label htmlFor="nome" className="text-sm font-medium">
              Nome
            </label>
            <input
              id="nome"
              name="nome"
              className="campo mt-1"
              required
              placeholder="San Giuseppe, patrono"
            />
          </div>
          <button type="submit" className="bottone bottone-primario self-end">
            Aggiungi
          </button>
          <div className="flex flex-wrap gap-4 text-sm sm:col-span-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="copertura" value="si" defaultChecked />
              Usa la copertura festiva
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="nazionale" value="si" />
              È una festività nazionale
            </label>
          </div>
        </form>

        <div className="space-y-3">
          <h2 className="text-sm font-medium text-tenue">
            Da qui in avanti ({future.length})
          </h2>
          {future.map(riga)}
          {future.length === 0 && (
            <p className="text-sm text-tenue">
              Nessuna festività futura in calendario. I piani che generi non ne
              terranno conto.
            </p>
          )}
        </div>

        {passate.length > 0 && (
          <details className="scheda p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Già passate ({passate.length})
            </summary>
            <div className="mt-3 space-y-3">{passate.map(riga)}</div>
          </details>
        )}
      </main>
    </>
  )
}
