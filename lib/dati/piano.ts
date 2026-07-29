import "server-only"

import { aggiungiGiorni, giorniNelMese, primoDelMese } from "@/lib/solver/tempo"
import {
  PESI_DEFAULT,
  REGOLE_DEFAULT,
  type DatiIngresso,
} from "@/lib/solver/modello"
import type { Pesi, Regole, Vincolo, Violazione } from "@/lib/solver/tipi"
import { creaClientServer } from "@/lib/supabase/server"

/**
 * Carica tutto ciò che serve al solver per un mese.
 *
 * Include i 7 giorni precedenti al mese: senza quelli i riposi e la rotazione
 * si rompono al cambio mese, che è esattamente il punto in cui i piani fatti a
 * mano sbagliano più spesso.
 */
export async function caricaDatiSolver(mese: string): Promise<DatiIngresso> {
  const sb = await creaClientServer()
  const inizio = primoDelMese(mese)
  const fine = aggiungiGiorni(inizio, giorniNelMese(mese) - 1)
  const inizioContesto = aggiungiGiorni(inizio, -7)

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
    esistenti,
  ] = await Promise.all([
    sb.from("shift_types").select("*").eq("attivo", true).order("ordine_rotazione"),
    sb.from("positions").select("*").eq("attiva", true).order("ordine"),
    sb.from("workers").select("*").eq("attivo", true).order("cognome"),
    sb.from("worker_positions").select("worker_id, position_id"),
    sb.from("coverage_rules").select("*"),
    sb.from("holidays").select("data, usa_copertura_festiva").gte("data", inizioContesto).lte("data", fine),
    sb.from("absences").select("*").lte("dal", fine).gte("al", inizioContesto),
    sb.from("constraints").select("*").eq("attivo", true),
    sb.from("settings").select("*"),
    sb
      .from("assignments")
      .select("data, worker_id, shift_type_id, position_id, bloccato")
      .gte("data", inizioContesto)
      .lte("data", fine),
  ])

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
  const sb = await creaClientServer()
  const inizio = primoDelMese(mese)

  const { data: piano, error: erroreUpsert } = await sb
    .from("schedules")
    .upsert(
      {
        mese: inizio,
        seed: seme,
        punteggio: punteggio as never,
        aggiornato_il: new Date().toISOString(),
      },
      { onConflict: "mese" },
    )
    .select()
    .single()

  if (erroreUpsert || !piano) {
    throw new Error(erroreUpsert?.message ?? "Impossibile salvare il piano.")
  }

  // Sostituzione integrale: il solver produce sempre il mese completo.
  await sb.from("assignments").delete().eq("schedule_id", piano.id)
  await sb.from("violations").delete().eq("schedule_id", piano.id)

  if (assegnazioni.length > 0) {
    const { error } = await sb.from("assignments").insert(
      assegnazioni.map((a) => ({
        schedule_id: piano.id,
        data: a.data,
        worker_id: a.worker_id,
        shift_type_id: a.shift_type_id,
        position_id: a.position_id,
        bloccato: a.bloccato,
        origine: a.bloccato ? ("manuale" as const) : ("solver" as const),
      })),
    )
    if (error) throw new Error(error.message)
  }

  if (violazioni.length > 0) {
    await sb.from("violations").insert(
      violazioni.slice(0, 500).map((v) => ({
        schedule_id: piano.id,
        tipo: v.tipo,
        gravita: v.gravita,
        messaggio: v.messaggio,
        data: v.data ?? null,
        riferimenti: (v.riferimenti ?? {}) as never,
      })),
    )
  }

  return piano
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
