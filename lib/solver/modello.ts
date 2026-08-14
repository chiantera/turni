/**
 * Costruzione del modello risolvibile a partire dai dati grezzi.
 *
 * Due responsabilità delicate stanno qui:
 *
 *  1. L'orizzonte include la CODA DEL MESE PRECEDENTE (default 7 giorni). Senza
 *     di essa il 1° del mese verrebbe pianificato ignorando che qualcuno ha
 *     appena finito un blocco di notti, e i riposi salterebbero a ogni cambio
 *     mese. Quei giorni sono di sola lettura: vincolano ma non si assegnano.
 *
 *  2. La risoluzione del fabbisogno: una data festiva usa la regola
 *     `tipo_giorno='festivo'` se esiste, altrimenti quella del giorno della
 *     settimana.
 */

import {
  aggiungiGiorni,
  componiData,
  differenzaGiorni,
  giorniNelMese,
  giornoSettimana,
  localeAUtc,
  oraInMinuti,
  pezziData,
  primoDelMese,
} from "./tempo"
import type {
  AssegnazioneFissa,
  Lavoratore,
  Modello,
  Pesi,
  Postazione,
  Regole,
  Slot,
  TipoTurno,
  Vincolo,
} from "./tipi"

// --- Forme grezze in ingresso (corrispondono alle righe del DB) -------------

export interface RigaTurno {
  id: string
  codice: string
  nome: string
  ora_inizio: string
  durata_min: number
  scavalca_mezzanotte: boolean
  is_notte: boolean
  ordine_rotazione: number | null
  conta_nelle_ore: boolean
  peso_ore: number
}

export interface RigaPostazione {
  id: string
  nome: string
}

export interface RigaLavoratore {
  id: string
  nome: string
  cognome: string
  ore_settimanali: number
  riposo_min_dopo_notte_h: number
  max_giorni_consecutivi: number
}

export interface RigaCopertura {
  position_id: string
  shift_type_id: string
  giorno_settimana: number | null
  tipo_giorno: "feriale" | "festivo"
  n_richiesti: number
  valido_dal?: string | null
  valido_al?: string | null
}

export interface RigaAssenza {
  worker_id: string
  dal: string
  al: string
  giornata_intera: boolean
  shift_type_id: string | null
}

export interface RigaAssegnazioneEsistente {
  data: string
  worker_id: string
  shift_type_id: string
  position_id: string
  bloccato: boolean
}

export interface DatiIngresso {
  /** Mese da pianificare, una data qualsiasi al suo interno. */
  mese: string
  /** Intervallo inclusivo; se omesso viene pianificato l'intero mese. */
  dal?: string
  al?: string
  turni: RigaTurno[]
  postazioni: RigaPostazione[]
  lavoratori: RigaLavoratore[]
  abilitazioni: { worker_id: string; position_id: string }[]
  copertura: RigaCopertura[]
  festivita: { data: string; usa_copertura_festiva: boolean }[]
  assenze: RigaAssenza[]
  vincoli: Vincolo[]
  /** Assegnazioni dei giorni di contesto + eventuali blocchi nel mese. */
  assegnazioniEsistenti: RigaAssegnazioneEsistente[]
  pesi: Pesi
  regole: Regole
  /** Giorni precedenti caricati solo come contesto immutabile. */
  giorniContesto?: number
  /** Giorni successivi caricati solo come contesto immutabile. */
  giorniContestoDopo?: number
}

const GIORNI = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
]

/** Errore di configurazione: i dati non descrivono un fabbisogno univoco. */
export class ErroreCoperturaAmbigua extends Error {
  constructor(messaggio: string) {
    super(messaggio)
    this.name = "ErroreCoperturaAmbigua"
  }
}

/**
 * Sceglie la regola di copertura valida per una data.
 *
 * Se piu' regole sono valide contemporaneamente per la stessa chiave non
 * esiste una risposta corretta: sceglierne una in base all'ordine di
 * inserimento renderebbe il piano dipendente dall'ordine delle righe nel
 * database, e la stessa configurazione produrrebbe risultati diversi a
 * distanza di tempo. Meglio fermarsi e dire quale conflitto risolvere.
 */
export function regolaCoperturaPerData(
  regole: RigaCopertura[] | undefined,
  data: string,
  descrizione: string,
): RigaCopertura | null {
  if (!regole || regole.length === 0) return null

  const valide = regole.filter(
    (r) =>
      (!r.valido_dal || data >= r.valido_dal) &&
      (!r.valido_al || data <= r.valido_al),
  )

  if (valide.length === 0) return null
  if (valide.length === 1) return valide[0]

  const intervalli = valide
    .map((r) => `${r.valido_dal ?? "sempre"}..${r.valido_al ?? "sempre"} (${r.n_richiesti})`)
    .join(", ")
  throw new ErroreCoperturaAmbigua(
    `Copertura ambigua per ${descrizione} il ${data}: ${valide.length} regole ` +
      `si sovrappongono [${intervalli}]. Correggi gli intervalli di validità ` +
      `perché per ogni data ne resti valida una sola.`,
  )
}

export const PESI_DEFAULT: Pesi = {
  ore_target: 100,
  pattern_settimanale: 60,
  rotazione_avanti: 40,
  equita_notti: 30,
  equita_weekend: 25,
  // Alla pari con `ore_target`: rispettare il proprio contratto e non stare
  // peggio dei colleghi contano uguale. A 20 le ore si sparpagliavano fino a
  // 10h di scarto fra la persona più carica e la meno carica sullo stesso
  // mese; misurato su 15 piani (7..14 lavoratori x 3 semi), portarlo a 100
  // riduce la dispersione media da 7,2h a 5,7h senza lasciare scoperto un
  // solo turno. Costa circa 0,3 notti di dispersione in più: le notti e le
  // ore non si possono appianare entrambe al massimo.
  equita_ore: 100,
  stabilita_postazione: 15,
  giorno_isolato: 35,
  riposo_isolato: 25,
  preferenze: 50,
}

export const REGOLE_DEFAULT: Regole = {
  riposoMinOre: 11,
  riposoDopoNotteOre: 48,
  maxGiorniConsecutivi: 6,
  maxOreSettimana: 48,
}

export function costruisciModello(d: DatiIngresso): Modello {
  const giorniContesto = d.giorniContesto ?? 7
  const giorniContestoDopo = d.giorniContestoDopo ?? 0

  // --- Orizzonte -----------------------------------------------------------
  const inizioPeriodo = d.dal ?? primoDelMese(d.mese)
  const finePeriodo =
    d.al ?? aggiungiGiorni(inizioPeriodo, giorniNelMese(d.mese) - 1)
  const nGiorniPeriodo = differenzaGiorni(inizioPeriodo, finePeriodo) + 1
  const inizioOrizzonte = aggiungiGiorni(inizioPeriodo, -giorniContesto)
  const nGiorni = giorniContesto + nGiorniPeriodo + giorniContestoDopo
  const offsetPeriodo = giorniContesto
  const fineOffsetPeriodo = offsetPeriodo + nGiorniPeriodo

  const date: string[] = []
  for (let i = 0; i < nGiorni; i++) date.push(aggiungiGiorni(inizioOrizzonte, i))

  // --- Indici --------------------------------------------------------------
  const turni: TipoTurno[] = d.turni.map((t) => ({
    id: t.id,
    codice: t.codice,
    nome: t.nome,
    inizioMin: oraInMinuti(t.ora_inizio),
    durataMin: t.durata_min,
    scavalcaMezzanotte: t.scavalca_mezzanotte,
    isNotte: t.is_notte,
    ordineRotazione: t.ordine_rotazione,
    contaNelleOre: t.conta_nelle_ore,
    pesoOre: t.peso_ore,
  }))
  const postazioni: Postazione[] = d.postazioni.map((p) => ({
    id: p.id,
    nome: p.nome,
  }))

  const idxTurno = new Map(turni.map((t, i) => [t.id, i]))
  const idxPost = new Map(postazioni.map((p, i) => [p.id, i]))
  const idxLav = new Map(d.lavoratori.map((l, i) => [l.id, i]))

  const nTurni = turni.length
  const nPost = postazioni.length
  const nLav = d.lavoratori.length

  // --- Abilitazioni --------------------------------------------------------
  const abilitato = new Uint8Array(nLav * nPost)
  for (const a of d.abilitazioni) {
    const li = idxLav.get(a.worker_id)
    const pi = idxPost.get(a.position_id)
    if (li !== undefined && pi !== undefined) abilitato[li * nPost + pi] = 1
  }

  const lavoratori: Lavoratore[] = d.lavoratori.map((l, li) => {
    const abil: number[] = []
    for (let pi = 0; pi < nPost; pi++) {
      if (abilitato[li * nPost + pi]) abil.push(pi)
    }
    return {
      id: l.id,
      nome: l.nome,
      cognome: l.cognome,
      oreSettimanali: Number(l.ore_settimanali),
      riposoDopoNotteH: l.riposo_min_dopo_notte_h,
      maxGiorniConsecutivi: l.max_giorni_consecutivi,
      postazioniAbilitate: abil,
    }
  })

  // --- Istanti reali di inizio/fine turno ----------------------------------
  // Precalcolati una volta sola: il ciclo di ricerca locale li legge milioni
  // di volte e non può permettersi conversioni di fuso orario.
  const inizioUtc = new Float64Array(nGiorni * nTurni)
  const fineUtc = new Float64Array(nGiorni * nTurni)
  for (let g = 0; g < nGiorni; g++) {
    const [anno, mese, giorno] = pezziData(date[g])
    for (let t = 0; t < nTurni; t++) {
      const tt = turni[t]
      const ora = Math.floor(tt.inizioMin / 60)
      const min = tt.inizioMin % 60
      const ini = localeAUtc(anno, mese, giorno, ora, min)
      inizioUtc[g * nTurni + t] = ini
      // La fine si ricava dall'orario di fine sul calendario, non sommando la
      // durata: è l'unico modo di ottenere l'istante reale nella notte del
      // cambio ora legale.
      const fineMinAssoluti = tt.inizioMin + tt.durataMin
      const giorniAvanti = Math.floor(fineMinAssoluti / 1440)
      const restoMin = fineMinAssoluti % 1440
      const dataFine = aggiungiGiorni(date[g], giorniAvanti)
      const [fa, fm, fg] = pezziData(dataFine)
      fineUtc[g * nTurni + t] = localeAUtc(
        fa,
        fm,
        fg,
        Math.floor(restoMin / 60),
        restoMin % 60,
      )
    }
  }

  // --- Festività e settimane ----------------------------------------------
  const festivi = new Map(d.festivita.map((f) => [f.data, f.usa_copertura_festiva]))
  const giornoFestivo: boolean[] = date.map(
    (dt) => festivi.has(dt) || giornoSettimana(dt) === 0,
  )

  // Settimane ancorate al lunedì, così le 38h si misurano lunedì-domenica.
  const settimanaDi: number[] = []
  const ancore = new Map<string, number>()
  for (const dt of date) {
    const dow = giornoSettimana(dt) // 0=dom
    const arretra = (dow + 6) % 7 // giorni indietro fino al lunedì
    const lunedi = aggiungiGiorni(dt, -arretra)
    let idx = ancore.get(lunedi)
    if (idx === undefined) {
      idx = ancore.size
      ancore.set(lunedi, idx)
    }
    settimanaDi.push(idx)
  }
  const nSettimane = ancore.size

  // --- Slot da coprire (solo nell'intervallo pianificato) ------------------
  // Ogni chiave punta a un ELENCO di regole, non a una sola: la stessa
  // postazione/turno/giorno puo' avere fabbisogni diversi in periodi diversi
  // (agosto, festivita', picchi stagionali). Tenerne una sola significherebbe
  // far vincere l'ultima riga letta dal database, cioe' far dipendere il piano
  // dall'ordine delle righe.
  const copFestiva = new Map<string, RigaCopertura[]>()
  const copFeriale = new Map<string, RigaCopertura[]>()
  const accumula = (mappa: Map<string, RigaCopertura[]>, k: string, c: RigaCopertura) => {
    const v = mappa.get(k)
    if (v) v.push(c)
    else mappa.set(k, [c])
  }
  for (const c of d.copertura) {
    const k = `${c.position_id}:${c.shift_type_id}`
    if (c.tipo_giorno === "festivo") accumula(copFestiva, k, c)
    else accumula(copFeriale, `${k}:${c.giorno_settimana}`, c)
  }

  const slots: Slot[] = []
  for (let g = offsetPeriodo; g < fineOffsetPeriodo; g++) {
    const dt = date[g]
    const dow = giornoSettimana(dt)
    const usaFestiva = festivi.get(dt) === true
    for (let pi = 0; pi < nPost; pi++) {
      for (let ti = 0; ti < nTurni; ti++) {
        const k = `${postazioni[pi].id}:${turni[ti].id}`
        const descrizione = `${postazioni[pi].nome} / ${turni[ti].nome}`

        // La regola festiva sostituisce quella del giorno, ma solo se ne
        // esiste una valida per questa data.
        const regola =
          (usaFestiva
            ? regolaCoperturaPerData(copFestiva.get(k), dt, `${descrizione} (festivo)`)
            : null) ??
          regolaCoperturaPerData(
            copFeriale.get(`${k}:${dow}`),
            dt,
            `${descrizione} (${GIORNI[dow]})`,
          )

        if (!regola) continue
        for (let n = 0; n < regola.n_richiesti; n++) {
          slots.push({
            idx: slots.length,
            giornoIdx: g,
            data: dt,
            postazioneIdx: pi,
            turnoIdx: ti,
          })
        }
      }
    }
  }

  // --- Assenze -------------------------------------------------------------
  const assente = new Uint8Array(nLav * nGiorni)
  const assenteSuTurno = new Set<string>()
  for (const a of d.assenze) {
    const li = idxLav.get(a.worker_id)
    if (li === undefined) continue
    const da = Math.max(0, differenzaGiorni(inizioOrizzonte, a.dal))
    const al = Math.min(nGiorni - 1, differenzaGiorni(inizioOrizzonte, a.al))
    for (let g = da; g <= al; g++) {
      if (g < 0 || g >= nGiorni) continue
      if (a.giornata_intera) {
        assente[li * nGiorni + g] = 1
      } else if (a.shift_type_id) {
        const ti = idxTurno.get(a.shift_type_id)
        if (ti !== undefined) assenteSuTurno.add(`${li}:${g}:${ti}`)
      }
    }
  }

  // --- Assegnazioni già esistenti -----------------------------------------
  const fisse: AssegnazioneFissa[] = []
  for (const a of d.assegnazioniEsistenti) {
    const li = idxLav.get(a.worker_id)
    const ti = idxTurno.get(a.shift_type_id)
    const pi = idxPost.get(a.position_id)
    if (li === undefined || ti === undefined || pi === undefined) continue
    const g = differenzaGiorni(inizioOrizzonte, a.data)
    if (g < 0 || g >= nGiorni) continue
    const nelPeriodo = g >= offsetPeriodo && g < fineOffsetPeriodo
    // Nel periodo pianificato conta solo se l'utente l'ha bloccata a mano;
    // fuori dal periodo (coda del mese precedente) è sempre immutabile.
    if (nelPeriodo && !a.bloccato) continue
    fisse.push({
      data: a.data,
      lavoratoreIdx: li,
      turnoIdx: ti,
      postazioneIdx: pi,
      nelPeriodo,
    })
  }

  return {
    inizioOrizzonte,
    inizioPeriodo,
    finePeriodo,
    nGiorni,
    offsetPeriodo,
    fineOffsetPeriodo,
    turni,
    postazioni,
    lavoratori,
    slots,
    fisse,
    vincoli: d.vincoli,
    pesi: d.pesi,
    regole: d.regole,
    date,
    giornoFestivo,
    settimanaDi,
    nSettimane,
    inizioUtc,
    fineUtc,
    assente,
    assenteSuTurno,
    abilitato,
  }
}

/** Giorni del mese pianificato che ricadono in ciascuna settimana. */
export function giorniPeriodoPerSettimana(m: Modello): number[] {
  const conta = new Array(m.nSettimane).fill(0)
  for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
    conta[m.settimanaDi[g]]++
  }
  return conta
}

/** Helper per i test: costruisce le date del mese senza passare dal DB. */
export function dateDelMese(mese: string): string[] {
  const inizio = primoDelMese(mese)
  const n = giorniNelMese(mese)
  const out: string[] = []
  const [a, m] = pezziData(inizio)
  for (let g = 1; g <= n; g++) out.push(componiData(a, m, g))
  return out
}
