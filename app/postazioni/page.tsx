import { revalidatePath } from "next/cache"

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
      attiva: formData.get("attiva") === "on",
    })
    .eq("id", id)
  revalidatePath("/postazioni")
}

async function elimina(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  // Disattivo invece di cancellare: le postazioni sono referenziate dai piani
  // già generati, e cancellarle ne riscriverebbe la storia.
  await sb.from("positions").update({ attiva: false }).eq("id", String(formData.get("id")))
  revalidatePath("/postazioni")
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
            <form
              key={p.id}
              action={aggiorna}
              className={`scheda p-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto] items-end ${
                p.attiva ? "" : "opacity-50"
              }`}
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
              <label className="flex items-center gap-2 text-sm pb-2">
                <input type="checkbox" name="attiva" defaultChecked={p.attiva} />
                attiva
              </label>
              <button type="submit" className="bottone">
                Salva
              </button>
            </form>
          ))}

          {(data ?? []).length === 0 && (
            <p className="text-sm text-tenue">Nessuna postazione. Aggiungine una qui sopra.</p>
          )}
        </div>

        <form action={elimina} className="hidden" />
      </main>
    </>
  )
}
