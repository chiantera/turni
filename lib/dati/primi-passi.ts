import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/types"

type Client = SupabaseClient<Database>

/**
 * Lo stato della configurazione, **misurato** e mai memorizzato.
 *
 * La tentazione sarebbe una colonna `onboarding_completato` sul profilo: si
 * scrive una volta e resta. Ma il giorno in cui qualcuno disattiva l'ultimo
 * lavoratore il flag continua a dire "tutto a posto", e la guida diventa una
 * bugia che nessuno smentisce. Qui ogni passo e' una domanda al database,
 * quindi la risposta e' sempre quella di adesso.
 */
export interface StatoConfigurazione {
  lavoratoriAttivi: number
  /** Attivi che non sanno coprire nessuna postazione: il solver non li vede. */
  lavoratoriSenzaAbilitazione: number
  postazioniAttive: number
  turniAttivi: number
  /** Regole che chiedono almeno una persona: `n_richiesti = 0` non e' domanda. */
  regoleCoperturaRichieste: number
  pianiGenerati: number
}

export interface PassoConfigurazione {
  id: string
  titolo: string
  /** Cosa si ottiene facendolo, in una riga. */
  spiegazione: string
  href: string
  azione: string
  fatto: boolean
  /** Il numero che dimostra l'esito, o cosa manca esattamente. */
  dettaglio: string
}

function plurale(n: number, uno: string, molti: string): string {
  return `${n} ${n === 1 ? uno : molti}`
}

/**
 * I cinque passi, nell'ordine in cui dipendono l'uno dall'altro.
 *
 * L'ordine non e' didattico ma causale: senza persone non c'e' niente da
 * distribuire, senza postazioni e turni non c'e' dove metterle, senza
 * abilitazioni il solver non sa chi puo' stare dove, senza copertura non sa
 * quante ne servono. Il piano e' l'unico passo che produce qualcosa.
 */
export function primiPassi(stato: StatoConfigurazione): PassoConfigurazione[] {
  const strutturaPronta = stato.postazioniAttive > 0 && stato.turniAttivi > 0

  return [
    {
      id: "lavoratori",
      titolo: "Chi lavora",
      spiegazione:
        "Le persone da distribuire, con il loro contratto: ore settimanali, part time, riposi minimi.",
      href: "/lavoratori",
      azione: "Vai ai lavoratori",
      fatto: stato.lavoratoriAttivi > 0,
      dettaglio:
        stato.lavoratoriAttivi > 0
          ? `${plurale(stato.lavoratoriAttivi, "lavoratore attivo", "lavoratori attivi")}.`
          : "Nessun lavoratore attivo: senza persone non c'è niente da distribuire.",
    },
    {
      id: "struttura",
      titolo: "Dove e quando",
      spiegazione:
        "Le postazioni da presidiare e i turni che le coprono, con orari e durata.",
      href: "/postazioni",
      azione: "Vai alle postazioni",
      fatto: strutturaPronta,
      dettaglio: strutturaPronta
        ? `${plurale(stato.postazioniAttive, "postazione attiva", "postazioni attive")}, ${plurale(stato.turniAttivi, "turno", "turni")}.`
        : stato.postazioniAttive === 0
          ? "Nessuna postazione attiva."
          : "Nessun turno attivo: le postazioni non hanno orari da coprire.",
    },
    {
      id: "abilitazioni",
      titolo: "Chi può stare dove",
      spiegazione:
        "Le abilitazioni, una per lavoratore e postazione. Chi non ne ha nessuna non viene mai assegnato.",
      href: "/lavoratori",
      azione: "Assegna le abilitazioni",
      fatto:
        stato.lavoratoriAttivi > 0 && stato.lavoratoriSenzaAbilitazione === 0,
      dettaglio:
        stato.lavoratoriAttivi === 0
          ? "Prima servono i lavoratori."
          : stato.lavoratoriSenzaAbilitazione === 0
            ? "Ogni lavoratore attivo copre almeno una postazione."
            : `${plurale(stato.lavoratoriSenzaAbilitazione, "lavoratore non copre", "lavoratori non coprono")} nessuna postazione: il piano uscirà scoperto senza dire perché.`,
    },
    {
      id: "copertura",
      titolo: "Quante persone servono",
      spiegazione:
        "Per ogni postazione, turno e giorno della settimana: il fabbisogno da soddisfare.",
      href: "/copertura",
      azione: "Vai alla copertura",
      fatto: stato.regoleCoperturaRichieste > 0,
      dettaglio:
        stato.regoleCoperturaRichieste > 0
          ? `${plurale(stato.regoleCoperturaRichieste, "regola chiede", "regole chiedono")} almeno una persona.`
          : "Nessuna regola chiede personale: il piano uscirebbe vuoto.",
    },
    {
      id: "piano",
      titolo: "Genera il piano",
      spiegazione:
        "Il solver assegna i turni rispettando i vincoli. Puoi correggere a mano quello che decide.",
      href: "/pianificazione",
      azione: "Genera il piano",
      fatto: stato.pianiGenerati > 0,
      dettaglio:
        stato.pianiGenerati > 0
          ? `${plurale(stato.pianiGenerati, "piano generato", "piani generati")}.`
          : "Nessun piano ancora generato.",
    },
  ]
}

/** Il primo passo non ancora fatto, o `null` se la configurazione è completa. */
export function passoSuccessivo(
  passi: PassoConfigurazione[],
): PassoConfigurazione | null {
  return passi.find((p) => !p.fatto) ?? null
}

/**
 * Lo stato letto con l'identità dell'utente collegato.
 *
 * Come per le statistiche, nessun filtro per ruolo in TypeScript: lo fa RLS.
 * Un `lavoratore` vedrà quindi conteggi ridotti ai propri, ed è coerente —
 * la guida gli dice cosa può vedere lui, non cosa esiste.
 */
export async function leggiStatoConfigurazione(
  sb: Client,
): Promise<StatoConfigurazione> {
  const [lavoratori, postazioni, turni, copertura, piani, abilitazioni] =
    await Promise.all([
      sb.from("workers").select("id").eq("attivo", true),
      sb
        .from("positions")
        .select("id", { count: "exact", head: true })
        .eq("attiva", true),
      sb
        .from("shift_types")
        .select("id", { count: "exact", head: true })
        .eq("attivo", true),
      sb
        .from("coverage_rules")
        .select("id", { count: "exact", head: true })
        .gt("n_richiesti", 0),
      sb.from("planning_runs").select("id", { count: "exact", head: true }),
      sb.from("worker_positions").select("worker_id"),
    ])
  for (const esito of [lavoratori, postazioni, turni, copertura, piani, abilitazioni]) {
    if (esito.error) throw esito.error
  }

  const abilitati = new Set((abilitazioni.data ?? []).map((r) => r.worker_id))
  const attivi = lavoratori.data ?? []

  return {
    lavoratoriAttivi: attivi.length,
    lavoratoriSenzaAbilitazione: attivi.filter((l) => !abilitati.has(l.id)).length,
    postazioniAttive: postazioni.count ?? 0,
    turniAttivi: turni.count ?? 0,
    regoleCoperturaRichieste: copertura.count ?? 0,
    pianiGenerati: piani.count ?? 0,
  }
}
