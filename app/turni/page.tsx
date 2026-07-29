import { revalidatePath } from "next/cache"

import Navigazione from "@/app/componenti/Navigazione"
import { oraInMinuti } from "@/lib/solver/tempo"
import { creaClientServer } from "@/lib/supabase/server"

export const metadata = { title: "Tipi di turno — Turni" }
export const dynamic = "force-dynamic"

/** Durata reale fra due orari da calendario, gestendo lo scavalco di mezzanotte. */
function durataMinuti(inizio: string, fine: string): number {
  const a = oraInMinuti(inizio)
  const b = oraInMinuti(fine)
  return b > a ? b - a : 1440 - a + b
}

async function salva(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  const inizio = String(formData.get("ora_inizio"))
  const fine = String(formData.get("ora_fine"))
  const durata = durataMinuti(inizio, fine)

  const valori = {
    codice: String(formData.get("codice") ?? "").trim().toUpperCase(),
    nome: String(formData.get("nome") ?? "").trim(),
    ora_inizio: inizio,
    ora_fine: fine,
    durata_min: durata,
    scavalca_mezzanotte: oraInMinuti(fine) <= oraInMinuti(inizio),
    is_notte: formData.get("is_notte") === "on",
    ordine_rotazione: formData.get("ordine_rotazione")
      ? Number(formData.get("ordine_rotazione"))
      : null,
    conta_nelle_ore: formData.get("conta_nelle_ore") === "on",
    peso_ore: Number(formData.get("peso_ore") ?? 1),
    colore: String(formData.get("colore") ?? "#64748b"),
    attivo: formData.get("attivo") === "on",
  }

  const id = formData.get("id")
  if (id) await sb.from("shift_types").update(valori).eq("id", String(id))
  else await sb.from("shift_types").insert(valori)

  revalidatePath("/turni")
  revalidatePath("/pianificazione/[mese]", "page")
}

export default async function Turni() {
  const sb = await creaClientServer()
  const { data } = await sb
    .from("shift_types")
    .select("*")
    .order("ordine_rotazione", { nullsFirst: false })

  const totale = (data ?? [])
    .filter((t) => t.conta_nelle_ore)
    .reduce((a, t) => a + t.durata_min, 0)

  return (
    <>
      <Navigazione />
      <main className="flex-1 mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Tipi di turno</h1>
          <p className="text-sm text-tenue mt-1 max-w-3xl leading-relaxed">
            Le durate determinano il ciclo. Con <strong>7h + 7h + 10h</strong> la
            settimana tipo <strong>2 mattini + 2 pomeriggi + 1 notte</strong> vale
            esattamente 38 ore, e i tre turni coprono le 24 ore senza sovrapposizioni.
            Cambiare gli orari cambia il ciclo: il solver si adatta, ma il numero di
            persone necessarie cambia di conseguenza.
          </p>
        </div>

        <div
          className={`scheda p-4 text-sm ${
            totale === 1440 ? "" : "bg-avviso-tenue text-avviso"
          }`}
        >
          {totale === 1440 ? (
            <>
              I turni conteggiati coprono esattamente le 24 ore ({totale / 60}h
              complessive).
            </>
          ) : (
            <>
              I turni conteggiati sommano {(totale / 60).toString().replace(".", ",")}h
              invece di 24h: la giornata {totale < 1440 ? "resta scoperta" : "presenta sovrapposizioni"} per{" "}
              {(Math.abs(1440 - totale) / 60).toString().replace(".", ",")}h.
            </>
          )}
        </div>

        <div className="space-y-3">
          {(data ?? []).map((t) => (
            <RigaTurno key={t.id} turno={t} />
          ))}
          <RigaTurno turno={null} />
        </div>
      </main>
    </>
  )
}

function RigaTurno({
  turno,
}: {
  turno: {
    id: string
    codice: string
    nome: string
    ora_inizio: string
    ora_fine: string
    durata_min: number
    is_notte: boolean
    ordine_rotazione: number | null
    conta_nelle_ore: boolean
    peso_ore: number
    colore: string
    attivo: boolean
  } | null
}) {
  const nuovo = turno === null
  return (
    <form
      id={turno ? `turno-${turno.id}` : undefined}
      action={salva}
      className={`scheda scroll-mt-4 p-4 grid gap-3 lg:grid-cols-[5rem_1fr_7rem_7rem_5rem_6rem_auto_auto] items-end target:ring-2 target:ring-accento ${
        turno && !turno.attivo ? "opacity-50" : ""
      }`}
    >
      {turno && <input type="hidden" name="id" value={turno.id} />}

      <div>
        <label className="text-xs text-tenue">Codice</label>
        <input
          name="codice"
          defaultValue={turno?.codice ?? ""}
          maxLength={4}
          className="campo mt-1 uppercase"
          required
          placeholder="M"
        />
      </div>
      <div>
        <label className="text-xs text-tenue">Nome</label>
        <input
          name="nome"
          defaultValue={turno?.nome ?? ""}
          className="campo mt-1"
          required
          placeholder="Mattino"
        />
      </div>
      <div>
        <label className="text-xs text-tenue">Inizio</label>
        <input
          name="ora_inizio"
          type="time"
          defaultValue={turno?.ora_inizio.slice(0, 5) ?? "07:00"}
          className="campo mt-1"
          required
        />
      </div>
      <div>
        <label className="text-xs text-tenue">Fine</label>
        <input
          name="ora_fine"
          type="time"
          defaultValue={turno?.ora_fine.slice(0, 5) ?? "14:00"}
          className="campo mt-1"
          required
        />
      </div>
      <div>
        <label className="text-xs text-tenue" title="M=1, P=2, N=3. Vuoto = fuori rotazione.">
          Rotaz.
        </label>
        <input
          name="ordine_rotazione"
          type="number"
          min={1}
          defaultValue={turno?.ordine_rotazione ?? ""}
          className="campo mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-tenue" title="Moltiplicatore sulle ore contabilizzate">
          Peso ore
        </label>
        <input
          name="peso_ore"
          type="number"
          step="0.05"
          min={0}
          defaultValue={turno?.peso_ore ?? 1}
          className="campo mt-1"
        />
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="is_notte" defaultChecked={turno?.is_notte ?? false} />
          notte
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="conta_nelle_ore"
            defaultChecked={turno?.conta_nelle_ore ?? true}
          />
          conta ore
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="attivo" defaultChecked={turno?.attivo ?? true} />
          attivo
        </label>
      </div>
      <div className="flex items-end gap-2">
        <input
          name="colore"
          type="color"
          defaultValue={turno?.colore ?? "#64748b"}
          className="campo h-9 w-14 p-1"
        />
        <button type="submit" className={`bottone ${nuovo ? "bottone-primario" : ""}`}>
          {nuovo ? "Aggiungi" : "Salva"}
        </button>
      </div>
    </form>
  )
}
