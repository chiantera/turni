import { revalidatePath } from "next/cache"

import Navigazione from "@/app/componenti/Navigazione"
import { dataEstesa } from "@/lib/dati/formato"
import {
  statoCellaLavoratore,
} from "@/lib/dati/stato-cella-piano"
import { salvaAssenzaConCompatibilita } from "@/lib/dati/salvataggio-assenza"
import { creaClientServer } from "@/lib/supabase/server"
import type { Enums } from "@/lib/supabase/types"

export const metadata = { title: "Lavoratori — Turni" }
export const dynamic = "force-dynamic"

async function aggiungi(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  const { data } = await sb
    .from("workers")
    .insert({
      nome: String(formData.get("nome") ?? "").trim(),
      cognome: String(formData.get("cognome") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim() || null,
      ore_settimanali: Number(formData.get("ore_settimanali") ?? 38),
    })
    .select()
    .single()

  // Abilitato su tutte le postazioni per default: si restringe dopo, in fase
  // di rifinitura. Il contrario (nessuna abilitazione) renderebbe la persona
  // inutilizzabile e il piano pieno di buchi senza spiegazione.
  if (data) {
    const { data: postazioni } = await sb.from("positions").select("id").eq("attiva", true)
    if (postazioni?.length) {
      await sb
        .from("worker_positions")
        .insert(postazioni.map((p) => ({ worker_id: data.id, position_id: p.id })))
    }
  }
  revalidatePath("/lavoratori")
}

async function aggiorna(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  const id = String(formData.get("id"))

  await sb
    .from("workers")
    .update({
      nome: String(formData.get("nome") ?? "").trim(),
      cognome: String(formData.get("cognome") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim() || null,
      ore_settimanali: Number(formData.get("ore_settimanali") ?? 38),
      riposo_min_dopo_notte_h: Number(formData.get("riposo_min_dopo_notte_h") ?? 48),
      max_giorni_consecutivi: Number(formData.get("max_giorni_consecutivi") ?? 6),
      attivo: formData.get("attivo") === "on",
    })
    .eq("id", id)

  // Abilitazioni: sostituzione integrale in base alle caselle spuntate.
  const scelte = formData.getAll("postazioni").map(String)
  await sb.from("worker_positions").delete().eq("worker_id", id)
  if (scelte.length > 0) {
    await sb
      .from("worker_positions")
      .insert(scelte.map((p) => ({ worker_id: id, position_id: p })))
  }

  revalidatePath("/lavoratori")
}

async function aggiungiAssenza(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  const tipo = String(formData.get("tipo")) as Enums<"tipo_assenza">
  const nuovaAssenza = {
    worker_id: String(formData.get("worker_id")),
    dal: String(formData.get("dal")),
    al: String(formData.get("al")),
    tipo,
    giornata_intera: true,
  }
  await salvaAssenzaConCompatibilita(nuovaAssenza, async (assenza) => {
    const { error } = await sb.from("absences").insert(assenza)
    return { error }
  })
  revalidatePath("/lavoratori")
  revalidatePath("/pianificazione/[mese]", "page")
}

async function rimuoviAssenza(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  await sb.from("absences").delete().eq("id", String(formData.get("id")))
  revalidatePath("/lavoratori")
  revalidatePath("/pianificazione/[mese]", "page")
}

export default async function Lavoratori() {
  const sb = await creaClientServer()
  const oggi = new Date().toISOString().slice(0, 10)

  const [lavoratori, postazioni, abilitazioni, assenze] = await Promise.all([
    sb.from("workers").select("*").order("cognome"),
    sb.from("positions").select("*").eq("attiva", true).order("ordine"),
    sb.from("worker_positions").select("*"),
    sb.from("absences").select("*").gte("al", oggi).order("dal"),
  ])

  const abilPerLav = new Map<string, Set<string>>()
  for (const a of abilitazioni.data ?? []) {
    const s = abilPerLav.get(a.worker_id) ?? new Set()
    s.add(a.position_id)
    abilPerLav.set(a.worker_id, s)
  }

  const assenzePerLav = new Map<string, typeof assenze.data>()
  for (const a of assenze.data ?? []) {
    const v = assenzePerLav.get(a.worker_id) ?? []
    v.push(a)
    assenzePerLav.set(a.worker_id, v)
  }

  return (
    <>
      <Navigazione />
      <main className="flex-1 mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Lavoratori</h1>
          <p className="text-sm text-tenue mt-1">
            {(lavoratori.data ?? []).filter((l) => l.attivo).length} attivi su{" "}
            {(lavoratori.data ?? []).length} totali.
          </p>
        </div>

        <form action={aggiungi} className="scheda p-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_6rem_auto]">
          <div>
            <label className="text-xs text-tenue">Nome</label>
            <input name="nome" className="campo mt-1" required />
          </div>
          <div>
            <label className="text-xs text-tenue">Cognome</label>
            <input name="cognome" className="campo mt-1" required />
          </div>
          <div>
            <label className="text-xs text-tenue">Email</label>
            <input name="email" type="email" className="campo mt-1" />
          </div>
          <div>
            <label className="text-xs text-tenue">Ore/sett.</label>
            <input
              name="ore_settimanali"
              type="number"
              step="0.5"
              defaultValue={38}
              className="campo mt-1"
            />
          </div>
          <button type="submit" className="bottone bottone-primario self-end">
            Aggiungi
          </button>
        </form>

        <div className="space-y-4">
          {(lavoratori.data ?? []).map((l) => {
            const abil = abilPerLav.get(l.id) ?? new Set<string>()
            const ass = assenzePerLav.get(l.id) ?? []
            return (
              <div
                id={`lavoratore-${l.id}`}
                key={l.id}
                className={`scheda scroll-mt-4 p-4 target:ring-2 target:ring-accento ${l.attivo ? "" : "opacity-60"}`}
              >
                <form action={aggiorna} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr] items-end">
                  <input type="hidden" name="id" value={l.id} />
                  <div>
                    <label className="text-xs text-tenue">Nome</label>
                    <input name="nome" defaultValue={l.nome} className="campo mt-1" required />
                  </div>
                  <div>
                    <label className="text-xs text-tenue">Cognome</label>
                    <input name="cognome" defaultValue={l.cognome} className="campo mt-1" required />
                  </div>
                  <div>
                    <label className="text-xs text-tenue">Email</label>
                    <input
                      name="email"
                      type="email"
                      defaultValue={l.email ?? ""}
                      className="campo mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:col-span-3">
                    <div>
                      <label className="text-xs text-tenue">Ore settimanali</label>
                      <input
                        name="ore_settimanali"
                        type="number"
                        step="0.5"
                        defaultValue={Number(l.ore_settimanali)}
                        className="campo mt-1"
                      />
                    </div>
                    <div>
                      <label
                        className="text-xs text-tenue"
                        title="Il ciclo canonico ne produce 48: la notte finisce alle 07:00 e seguono due riposi."
                      >
                        Riposo dopo notte (h)
                      </label>
                      <input
                        name="riposo_min_dopo_notte_h"
                        type="number"
                        min={11}
                        max={96}
                        defaultValue={l.riposo_min_dopo_notte_h}
                        className="campo mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-tenue">Max giorni consecutivi</label>
                      <input
                        name="max_giorni_consecutivi"
                        type="number"
                        min={1}
                        max={13}
                        defaultValue={l.max_giorni_consecutivi}
                        className="campo mt-1"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <div className="text-xs text-tenue mb-1.5">Postazioni abilitate</div>
                    <div className="flex flex-wrap gap-3">
                      {(postazioni.data ?? []).map((p) => (
                        <label key={p.id} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            name="postazioni"
                            value={p.id}
                            defaultChecked={abil.has(p.id)}
                          />
                          {p.nome}
                        </label>
                      ))}
                      {(postazioni.data ?? []).length === 0 && (
                        <span className="text-sm text-tenue">
                          Nessuna postazione definita.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-3 flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="attivo" defaultChecked={l.attivo} />
                      in servizio
                    </label>
                    <button type="submit" className="bottone">
                      Salva
                    </button>
                  </div>
                </form>

                {/* --- Assenze --- */}
                <div className="mt-4 pt-4 border-t border-bordo">
                  <div className="text-xs text-tenue mb-2">Assenze programmate</div>
                  {ass.length > 0 && (
                    <ul className="space-y-1 mb-3">
                      {ass.map((a) => (
                        <li key={a.id} className="flex items-center gap-3 text-sm">
                          <span>
                            {statoCellaLavoratore({
                              workerId: a.worker_id,
                              data: a.dal,
                              assegnazionePresente: false,
                              assenze: [a],
                            })?.etichetta ?? a.tipo}
                          </span>
                          <span className="text-tenue">
                            dal {dataEstesa(a.dal)} al {dataEstesa(a.al)}
                          </span>
                          <form action={rimuoviAssenza}>
                            <input type="hidden" name="id" value={a.id} />
                            <button
                              type="submit"
                              className="text-allarme text-xs underline"
                            >
                              rimuovi
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form
                    action={aggiungiAssenza}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="worker_id" value={l.id} />
                    <div>
                      <label className="text-xs text-tenue">Dal</label>
                      <input name="dal" type="date" className="campo mt-1" required />
                    </div>
                    <div>
                      <label className="text-xs text-tenue">Al</label>
                      <input name="al" type="date" className="campo mt-1" required />
                    </div>
                    <div>
                      <label className="text-xs text-tenue">Tipo</label>
                      <select name="tipo" className="campo mt-1">
                        <option value="ferie">Ferie</option>
                        <option value="malattia">Malattia</option>
                        <option value="disciplinare">Disciplinare</option>
                        <option value="studio">Permesso per studiare</option>
                        <option value="permesso">Permesso</option>
                        <option value="l104">Legge 104</option>
                        <option value="formazione">Formazione</option>
                        <option value="altro">Altro</option>
                      </select>
                    </div>
                    <button type="submit" className="bottone">
                      Aggiungi assenza
                    </button>
                  </form>
                </div>
              </div>
            )
          })}

          {(lavoratori.data ?? []).length === 0 && (
            <p className="text-sm text-tenue">Nessun lavoratore. Aggiungine uno qui sopra.</p>
          )}
        </div>
      </main>
    </>
  )
}
