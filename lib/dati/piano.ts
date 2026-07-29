import "server-only"

import {
  fineDelMese,
  limitiMensiliIntervallo,
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
  const piani = []
  const segmenti = limitiMensiliIntervallo(dal, al)

  for (const [indice, segmento] of segmenti.entries()) {
    const { data: piano, error: erroreUpsert } = await sb
      .from("schedules")
      .upsert(
        {
          mese: segmento.mese,
          seed: seme,
          parametri: { dal, al } as never,
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

    const precedenti = await sb
      .from("assignments")
      .select("id, data, worker_id")
      .eq("schedule_id", piano.id)
      .gte("data", segmento.dal)
      .lte("data", segmento.al)
    if (precedenti.error) throw new Error(precedenti.error.message)

    const segmentoIntero =
      segmento.dal === segmento.mese && segmento.al === fineDelMese(segmento.mese)
    const violazioniPrecedenti = segmentoIntero
      ? await sb.from("violations").select("id").eq("schedule_id", piano.id)
      : await sb
          .from("violations")
          .select("id")
          .eq("schedule_id", piano.id)
          .gte("data", segmento.dal)
          .lte("data", segmento.al)
    if (violazioniPrecedenti.error) throw new Error(violazioniPrecedenti.error.message)
    const idsViolazioniPrecedenti = (violazioniPrecedenti.data ?? []).map((v) => v.id)
    if (!segmentoIntero && indice === 0) {
      const globaliPrecedenti = await sb
        .from("violations")
        .select("id")
        .eq("schedule_id", piano.id)
        .is("data", null)
        .contains("riferimenti", { intervallo: { dal, al } } as never)
      if (globaliPrecedenti.error) throw new Error(globaliPrecedenti.error.message)
      idsViolazioniPrecedenti.push(
        ...(globaliPrecedenti.data ?? []).map((violazione) => violazione.id),
      )
    }

    const assegnazioniMese = assegnazioni.filter(
      (a) => a.data >= segmento.dal && a.data <= segmento.al,
    )
    if (assegnazioniMese.length > 0) {
      const { error } = await sb.from("assignments").upsert(
        assegnazioniMese.map((a) => ({
          schedule_id: piano.id,
          data: a.data,
          worker_id: a.worker_id,
          shift_type_id: a.shift_type_id,
          position_id: a.position_id,
          bloccato: a.bloccato,
          origine: a.bloccato ? ("manuale" as const) : ("solver" as const),
        })),
        { onConflict: "schedule_id,data,worker_id" },
      )
      if (error) throw new Error(error.message)
    }

    const chiaviNuove = new Set(
      assegnazioniMese.map((a) => `${a.data}:${a.worker_id}`),
    )
    const idsObsoleti = (precedenti.data ?? [])
      .filter((a) => !chiaviNuove.has(`${a.data}:${a.worker_id}`))
      .map((a) => a.id)
    for (let i = 0; i < idsObsoleti.length; i += 200) {
      const cancellate = await sb
        .from("assignments")
        .delete()
        .in("id", idsObsoleti.slice(i, i + 200))
      if (cancellate.error) throw new Error(cancellate.error.message)
    }

    const violazioniMese = violazioni.filter(
      (v) =>
        (v.data && v.data >= segmento.dal && v.data <= segmento.al) ||
        (!v.data && indice === 0),
    )
    if (violazioniMese.length > 0) {
      const inserite = await sb.from("violations").insert(
        violazioniMese.slice(0, 500).map((v) => ({
          schedule_id: piano.id,
          tipo: v.tipo,
          gravita: v.gravita,
          messaggio: v.messaggio,
          data: v.data ?? null,
          riferimenti: {
            ...(v.riferimenti ?? {}),
            intervallo: { dal, al },
          } as never,
        })),
      )
      if (inserite.error) throw new Error(inserite.error.message)
    }

    for (let i = 0; i < idsViolazioniPrecedenti.length; i += 200) {
      const cancellate = await sb
        .from("violations")
        .delete()
        .in("id", idsViolazioniPrecedenti.slice(i, i + 200))
      if (cancellate.error) throw new Error(cancellate.error.message)
    }

    piani.push(piano)
  }

  return piani
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
