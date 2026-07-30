import "server-only"

import {
  fineDelMese,
  validaIntervallo,
} from "@/lib/dati/intervallo"
import { aggiungiGiorni, primoDelMese } from "@/lib/solver/tempo"
import {
  PESI_DEFAULT,
  REGOLE_DEFAULT,
  type DatiIngresso,
} from "@/lib/solver/modello"
import type { Pesi, Regole, Vincolo, Violazione } from "@/lib/solver/tipi"
import { creaClientServer } from "@/lib/supabase/server"

/**
 * Carica tutto ciò che serve al solver per un intervallo inclusivo.
 *
 * Include i 7 giorni precedenti: senza quelli i riposi e la rotazione
 * si rompono al cambio di intervallo, che è esattamente il punto in cui i piani fatti a
 * mano sbagliano più spesso.
 */
export async function caricaDatiSolver(dal: string, al?: string): Promise<DatiIngresso> {
  const sb = await creaClientServer()
  const intervallo = al ? validaIntervallo(dal, al) : null
  const inizio = intervallo?.dal ?? primoDelMese(dal)
  const fine = intervallo?.al ?? fineDelMese(inizio)
  const inizioContesto = aggiungiGiorni(inizio, -7)
  const fineContesto = aggiungiGiorni(fine, 7)
  const run = await sb
    .from("planning_runs")
    .select("id")
    .eq("dal", inizio)
    .eq("al", fine)
    .maybeSingle()
  if (run.error) throw new Error(`Impossibile risolvere il piano intervallo: ${run.error.message}`)
  const segmenti = run.data
    ? await sb.from("schedules").select("id").eq("planning_run_id", run.data.id)
    : null
  if (segmenti?.error) throw new Error(`Impossibile leggere i segmenti del piano: ${segmenti.error.message}`)
  const esistenti = segmenti?.data?.length
    ? await sb
        .from("assignments")
        .select("data, worker_id, shift_type_id, position_id, bloccato")
        .in("schedule_id", segmenti.data.map((segmento) => segmento.id))
        .gte("data", inizioContesto)
        .lte("data", fineContesto)
    : { data: [], error: null }

  const [
    turni,
    postazioni,
    lavoratori,
    abilitazioni,
    copertura,
    festivita,
    assenze,
    vincoliDb,
    impostazioni,
  ] = await Promise.all([
    sb.from("shift_types").select("*").eq("attivo", true).order("ordine_rotazione"),
    sb.from("positions").select("*").eq("attiva", true).order("ordine"),
    sb.from("workers").select("*").eq("attivo", true).order("cognome"),
    sb.from("worker_positions").select("worker_id, position_id"),
    sb.from("coverage_rules").select("*"),
    sb
      .from("holidays")
      .select("data, usa_copertura_festiva")
      .gte("data", inizioContesto)
      .lte("data", fineContesto),
    sb.from("absences").select("*").lte("dal", fineContesto).gte("al", inizioContesto),
    sb.from("constraints").select("*").eq("attivo", true),
    sb.from("settings").select("*"),
    sb
      .from("assignments")
      .select("data, worker_id, shift_type_id, position_id, bloccato")
      .gte("data", inizioContesto)
      .lte("data", fineContesto),
  ])

  const erroreLettura = [
    turni,
    postazioni,
    lavoratori,
    abilitazioni,
    copertura,
    festivita,
    assenze,
    vincoliDb,
    impostazioni,
    esistenti,
  ].find((risultato) => risultato.error)?.error
  if (erroreLettura) {
    throw new Error(`Impossibile caricare i dati di pianificazione: ${erroreLettura.message}`)
  }

  const imp = new Map((impostazioni.data ?? []).map((r) => [r.chiave, r.valore]))
  const pesi = { ...PESI_DEFAULT, ...(imp.get("pesi") as Partial<Pesi> | undefined) }
  const regoleGrezze = imp.get("regole") as Record<string, number> | undefined
  const regole: Regole = regoleGrezze
    ? {
        riposoMinOre: regoleGrezze.riposo_min_ore ?? REGOLE_DEFAULT.riposoMinOre,
        riposoDopoNotteOre:
          regoleGrezze.riposo_dopo_notte_ore ?? REGOLE_DEFAULT.riposoDopoNotteOre,
        maxGiorniConsecutivi:
          regoleGrezze.max_giorni_consecutivi ?? REGOLE_DEFAULT.maxGiorniConsecutivi,
        maxOreSettimana: regoleGrezze.max_ore_settimana ?? REGOLE_DEFAULT.maxOreSettimana,
      }
    : REGOLE_DEFAULT

  const vincoli: Vincolo[] = (vincoliDb.data ?? []).map((v) => ({
    id: v.id,
    kind: v.kind as Vincolo["kind"],
    isHard: v.is_hard,
    peso: Number(v.peso),
    descrizione: v.descrizione,
    validoDal: v.valido_dal,
    validoAl: v.valido_al,
    params: (v.params ?? {}) as Record<string, unknown>,
  }))

  return {
    mese: inizio,
    dal: inizio,
    al: fine,
    turni: (turni.data ?? []).map((t) => ({
      id: t.id,
      codice: t.codice,
      nome: t.nome,
      ora_inizio: t.ora_inizio,
      durata_min: t.durata_min,
      scavalca_mezzanotte: t.scavalca_mezzanotte,
      is_notte: t.is_notte,
      ordine_rotazione: t.ordine_rotazione,
      conta_nelle_ore: t.conta_nelle_ore,
      peso_ore: Number(t.peso_ore),
    })),
    postazioni: (postazioni.data ?? []).map((p) => ({ id: p.id, nome: p.nome })),
    lavoratori: (lavoratori.data ?? []).map((l) => ({
      id: l.id,
      nome: l.nome,
      cognome: l.cognome,
      ore_settimanali: Number(l.ore_settimanali),
      riposo_min_dopo_notte_h: l.riposo_min_dopo_notte_h,
      max_giorni_consecutivi: l.max_giorni_consecutivi,
    })),
    abilitazioni: abilitazioni.data ?? [],
    copertura: (copertura.data ?? []).map((c) => ({
      position_id: c.position_id,
      shift_type_id: c.shift_type_id,
      giorno_settimana: c.giorno_settimana,
      tipo_giorno: c.tipo_giorno,
      n_richiesti: c.n_richiesti,
      valido_dal: c.valido_dal,
      valido_al: c.valido_al,
    })),
    festivita: festivita.data ?? [],
    assenze: (assenze.data ?? []).map((a) => ({
      worker_id: a.worker_id,
      dal: a.dal,
      al: a.al,
      giornata_intera: a.giornata_intera,
      shift_type_id: a.shift_type_id,
    })),
    vincoli,
    assegnazioniEsistenti: esistenti.data ?? [],
    pesi,
    regole,
    giorniContesto: 7,
    giorniContestoDopo: 7,
  }
}

/**
 * Sostituisce il piano di un mese con quello nuovo.
 * Le assegnazioni bloccate a mano vengono preservate: sono già dentro il
 * risultato del solver, che le ha trattate come immutabili.
 */
export async function salvaPiano(
  mese: string,
  assegnazioni: {
    data: string
    worker_id: string
    shift_type_id: string
    position_id: string
    bloccato: boolean
  }[],
  violazioni: Violazione[],
  punteggio: Record<string, unknown>,
  seme: number,
) {
  const inizio = primoDelMese(mese)
  const [piano] = await salvaIntervalloPiani(
    inizio,
    fineDelMese(inizio),
    assegnazioni,
    violazioni,
    punteggio,
    seme,
  )
  return piano
}

export async function salvaIntervalloPiani(
  dal: string,
  al: string,
  assegnazioni: {
    data: string
    worker_id: string
    shift_type_id: string
    position_id: string
    bloccato: boolean
  }[],
  violazioni: Violazione[],
  punteggio: Record<string, unknown>,
  seme: number,
) {
  validaIntervallo(dal, al)
  const sb = await creaClientServer()
  const { data, error } = await sb.rpc("salva_piano_intervallo", {
    p_dal: dal,
    p_al: al,
    p_seme: seme,
    p_parametri: { dal, al },
    p_punteggio: punteggio as never,
    p_assegnazioni: assegnazioni as never,
    p_violazioni: violazioni as never,
  })
  if (error) throw new Error(error.message)

  const risultato = data && typeof data === "object" && !Array.isArray(data)
    ? (data as { scheduleIds?: unknown }).scheduleIds
    : null
  const scheduleIds = Array.isArray(risultato)
    ? risultato.filter((id): id is string => typeof id === "string")
    : []
  if (scheduleIds.length === 0) throw new Error("Il salvataggio non ha restituito i segmenti del piano.")

  const piani = await sb.from("schedules").select().in("id", scheduleIds).order("mese")
  if (piani.error) throw new Error(piani.error.message)
  return piani.data ?? []
}

/** Contesto per l'estrazione AI: nomi che il modello può citare. */
export async function caricaContestoAI(mese: string) {
  const sb = await creaClientServer()
  const [lavoratori, postazioni, turni] = await Promise.all([
    sb.from("workers").select("id, nome, cognome").eq("attivo", true).order("cognome"),
    sb.from("positions").select("id, nome").eq("attiva", true).order("ordine"),
    sb.from("shift_types").select("id, codice, nome").eq("attivo", true),
  ])
  return {
    lavoratori: lavoratori.data ?? [],
    postazioni: postazioni.data ?? [],
    turni: turni.data ?? [],
    mese: primoDelMese(mese),
    oggi: new Date().toISOString().slice(0, 10),
  }
}
