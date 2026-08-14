import { revalidatePath } from "next/cache"

import BottoneConferma from "@/app/componenti/BottoneConferma"
import Navigazione from "@/app/componenti/Navigazione"
import { creaClientServer } from "@/lib/supabase/server"

export const metadata = { title: "Postazioni — Turni" }
export const dynamic = "force-dynamic"

async function aggiungi(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  await sb.from("positions").insert({
    nome: String(formData.get("nome") ?? "").trim(),
    descrizione: String(formData.get("descrizione") ?? "").trim() || null,
    colore: String(formData.get("colore") ?? "#0ea5e9"),
    ordine: Number(formData.get("ordine") ?? 0),
  })
  revalidatePath("/postazioni")
  revalidatePath("/pianificazione/[mese]", "page")
}

async function aggiorna(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  const id = String(formData.get("id"))
  await sb
    .from("positions")
    .update({
      nome: String(formData.get("nome") ?? "").trim(),
      descrizione: String(formData.get("descrizione") ?? "").trim() || null,
      colore: String(formData.get("colore") ?? "#0ea5e9"),
      // `attiva` non si tocca qui: la governa `cambiaStato`.
    })
    .eq("id", id)
  revalidatePath("/postazioni")
  revalidatePath("/pianificazione/[mese]", "page")
}

/**
 * Messa fuori uso e rimessa in uso.
 *
 * Si disattiva invece di cancellare: le postazioni sono referenziate dai piani
 * già generati, e cancellarle ne riscriverebbe la storia.
 */
async function cambiaStato(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  await sb
    .from("positions")
    .update({ attiva: formData.get("attiva") === "si" })
    .eq("id", String(formData.get("id")))
  revalidatePath("/postazioni")
  revalidatePath("/pianificazione/[mese]", "page")
}

export default async function Postazioni() {
  const sb = await creaClientServer()
  const { data } = await sb.from("positions").select("*").order("ordine")

  return (
    <>
      <Navigazione />
      <main className="flex-1 mx-auto w-full max-w-4xl p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Postazioni</h1>
          <p className="text-sm text-tenue mt-1">
            I posti di lavoro da presidiare. Ogni postazione ha una propria griglia
            di copertura.
          </p>
        </div>

        <form action={aggiungi} className="scheda p-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <div>
            <label htmlFor="nome" className="text-sm font-medium">
              Nome
            </label>
            <input id="nome" name="nome" className="campo mt-1" required placeholder="Reparto A" />
          </div>
          <div>
            <label htmlFor="descrizione" className="text-sm font-medium">
              Descrizione
            </label>
            <input id="descrizione" name="descrizione" className="campo mt-1" />
          </div>
          <div>
            <label htmlFor="colore" className="text-sm font-medium">
              Colore
            </label>
            <input
              id="colore"
              name="colore"
              type="color"
              defaultValue="#0ea5e9"
              className="campo mt-1 h-9 w-16 p-1"
            />
          </div>
          <button type="submit" className="bottone bottone-primario self-end">
            Aggiungi
          </button>
        </form>

        <div className="space-y-3">
          {(data ?? []).map((p) => (
            <div
              id={`postazione-${p.id}`}
              key={p.id}
              className={`scheda scroll-mt-4 p-4 target:ring-2 target:ring-accento ${
                p.attiva ? "" : "opacity-50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-bordo">
                <div className="font-medium">
                  {p.nome}
                  {!p.attiva && (
                    <span className="ml-2 text-xs font-normal text-tenue">(fuori uso)</span>
                  )}
                </div>
                {/* Fuori dal form di modifica: i form non si annidano. */}
                <form action={cambiaStato}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="attiva" value={p.attiva ? "no" : "si"} />
                  {p.attiva ? (
                    <BottoneConferma
                      etichetta="Disattiva"
                      conferma="Confermi la disattivazione?"
                    />
                  ) : (
                    <button type="submit" className="bottone">
                      Riattiva
                    </button>
                  )}
                </form>
              </div>

              <form
                action={aggiorna}
                className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] items-end"
              >
              <input type="hidden" name="id" value={p.id} />
              <div>
                <label className="text-xs text-tenue">Nome</label>
                <input name="nome" defaultValue={p.nome} className="campo mt-1" required />
              </div>
              <div>
                <label className="text-xs text-tenue">Descrizione</label>
                <input
                  name="descrizione"
                  defaultValue={p.descrizione ?? ""}
                  className="campo mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-tenue">Colore</label>
                <input
                  name="colore"
                  type="color"
                  defaultValue={p.colore}
                  className="campo mt-1 h-9 w-16 p-1"
                />
              </div>
              <button type="submit" className="bottone">
                Salva
              </button>
              </form>
            </div>
          ))}

          {(data ?? []).length === 0 && (
            <p className="text-sm text-tenue">Nessuna postazione. Aggiungine una qui sopra.</p>
          )}
        </div>
      </main>
    </>
  )
}
