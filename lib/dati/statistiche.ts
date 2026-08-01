import type { SupabaseClient } from "@supabase/supabase-js"

import { meseCorrente } from "./formato"
import type { Database, Tables } from "@/lib/supabase/types"

type Client = SupabaseClient<Database>

type TurnoOre = Pick<
  Tables<"shift_types">,
  "id" | "durata_min" | "peso_ore" | "conta_nelle_ore"
>

type AssegnazioneTurno = Pick<Tables<"assignments">, "shift_type_id">

export interface StatisticheDashboard {
  /** Piani che coprono il mese corrente (0 se il mese non è ancora pianificato). */
  pianiMese: number
  /** Ore contabilizzate nel piano più recente del mese, arrotondate all'intero. */
  oreMese: number
  lavoratoriAttivi: number
}

/**
 * Ore contabilizzate da un elenco di assegnazioni.
 *
 * Stessa formula usata dall'export xlsx e dal calcolo delle ore eccedenti:
 * i turni con `conta_nelle_ore = false` non pesano, gli altri valgono
 * `durata_min * peso_ore` (la reperibilità a 0.25 vale un quarto d'ora
 * per ogni ora di turno).
 */
export function oreAssegnate(
  assegnazioni: AssegnazioneTurno[],
  turni: TurnoOre[],
): number {
  const perId = new Map(turni.map((t) => [t.id, t]))
  let minuti = 0
  for (const a of assegnazioni) {
    const turno = perId.get(a.shift_type_id)
    if (!turno?.conta_nelle_ore) continue
    minuti += turno.durata_min * Number(turno.peso_ore)
  }
  return minuti / 60
}

/**
 * I tre numeri della dashboard, letti con l'identità dell'utente collegato.
 *
 * RLS fa da filtro implicito e cambia il significato dei valori a seconda del
 * ruolo: il pianificatore vede tutti i piani e tutte le ore del mese, il
 * lavoratore solo i piani pubblicati e le proprie ore. È voluto — la scheda
 * risponde a "quanto riguarda me questo mese".
 *
 * Quando più piani coprono lo stesso mese (run con intervalli diversi) le ore
 * si riferiscono al più recente, per non contare due volte gli stessi turni.
 */
export async function statisticheDashboard(
  sb: Client,
  mese = meseCorrente(),
): Promise<StatisticheDashboard> {
  const [piani, lavoratori] = await Promise.all([
    sb
      .from("schedules")
      .select("id")
      .eq("mese", mese)
      .order("aggiornato_il", { ascending: false }),
    sb.from("workers").select("id", { count: "exact", head: true }).eq("attivo", true),
  ])
  if (piani.error) throw piani.error
  if (lavoratori.error) throw lavoratori.error

  const pianoRecente = piani.data?.[0]
  let oreMese = 0

  if (pianoRecente) {
    const [assegnazioni, turni] = await Promise.all([
      sb.from("assignments").select("shift_type_id").eq("schedule_id", pianoRecente.id),
      sb.from("shift_types").select("id, durata_min, peso_ore, conta_nelle_ore"),
    ])
    if (assegnazioni.error) throw assegnazioni.error
    if (turni.error) throw turni.error

    oreMese = oreAssegnate(assegnazioni.data ?? [], turni.data ?? [])
  }

  return {
    pianiMese: piani.data?.length ?? 0,
    oreMese: Math.round(oreMese),
    lavoratoriAttivi: lavoratori.count ?? 0,
  }
}
