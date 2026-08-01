import type { SupabaseClient } from "@supabase/supabase-js"

import { etichettaIntervallo } from "./intervallo"
import type { Database, Tables } from "@/lib/supabase/types"

type Client = SupabaseClient<Database>

export type TipoAttivita = "piano" | "lavoratore" | "postazione"

export interface Attivita {
  id: string
  descrizione: string
  /** Timestamp ISO, come arriva da Postgres: la conversione a Date sta alla UI. */
  quando: string
  tipo: TipoAttivita
}

type RigaPiano = Pick<Tables<"planning_runs">, "id" | "dal" | "al" | "versione" | "aggiornato_il">
type RigaLavoratore = Pick<Tables<"workers">, "id" | "nome" | "cognome" | "creato_il">
type RigaPostazione = Pick<Tables<"positions">, "id" | "nome" | "creato_il">

export interface FontiAttivita {
  piani: RigaPiano[]
  lavoratori: RigaLavoratore[]
  postazioni: RigaPostazione[]
}

const LIMITE_PREDEFINITO = 5

/**
 * Fonde le tre sorgenti in un'unica cronologia, dalla più recente.
 *
 * Non esiste una tabella di audit: l'unica traccia di "cosa è successo" sono
 * i timestamp delle righe. Ne segue un limite di cui vale la pena essere
 * consapevoli — si vede quando qualcosa è stato creato o aggiornato, non
 * quante volte né da chi.
 */
export function componiAttivita(
  fonti: FontiAttivita,
  limite = LIMITE_PREDEFINITO,
): Attivita[] {
  const voci: Attivita[] = [
    ...fonti.piani.map((p) => ({
      id: `piano:${p.id}`,
      descrizione: `Piano ${etichettaIntervallo(p.dal, p.al)} ${
        p.versione > 1 ? "aggiornato" : "generato"
      }`,
      quando: p.aggiornato_il,
      tipo: "piano" as const,
    })),
    ...fonti.lavoratori.map((l) => ({
      id: `lavoratore:${l.id}`,
      descrizione: `Lavoratore «${l.cognome} ${l.nome}» aggiunto`,
      quando: l.creato_il,
      tipo: "lavoratore" as const,
    })),
    ...fonti.postazioni.map((p) => ({
      id: `postazione:${p.id}`,
      descrizione: `Postazione «${p.nome}» aggiunta`,
      quando: p.creato_il,
      tipo: "postazione" as const,
    })),
  ]

  return voci
    .sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando))
    .slice(0, limite)
}

/**
 * L'attività recente visibile all'utente collegato.
 *
 * Come per le statistiche, il filtro per ruolo lo fa RLS: il lavoratore vede
 * solo i piani pubblicati, il pianificatore tutti.
 */
export async function attivitaRecenti(
  sb: Client,
  limite = LIMITE_PREDEFINITO,
): Promise<Attivita[]> {
  const [piani, lavoratori, postazioni] = await Promise.all([
    sb
      .from("planning_runs")
      .select("id, dal, al, versione, aggiornato_il")
      .order("aggiornato_il", { ascending: false })
      .limit(limite),
    sb
      .from("workers")
      .select("id, nome, cognome, creato_il")
      .order("creato_il", { ascending: false })
      .limit(limite),
    sb
      .from("positions")
      .select("id, nome, creato_il")
      .order("creato_il", { ascending: false })
      .limit(limite),
  ])
  if (piani.error) throw piani.error
  if (lavoratori.error) throw lavoratori.error
  if (postazioni.error) throw postazioni.error

  return componiAttivita(
    {
      piani: piani.data ?? [],
      lavoratori: lavoratori.data ?? [],
      postazioni: postazioni.data ?? [],
    },
    limite,
  )
}
