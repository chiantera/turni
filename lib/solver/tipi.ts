/**
 * Tipi del solver.
 *
 * Deliberatamente indipendenti da Supabase: il solver riceve strutture pure e
 * non sa nulla del database. Questo lo rende testabile senza rete e riusabile
 * (browser, route handler, script).
 *
 * Convenzione: dentro il solver si lavora per INDICI (numeri) anziché per UUID.
 * I nomi `*Idx` sono indici negli array `lavoratori` / `turni` / `postazioni`.
 */

export interface TipoTurno {
  id: string
  codice: string // "M", "P", "N", ...
  nome: string
  inizioMin: number // minuti dalla mezzanotte
  durataMin: number // durata NOMINALE (usata per le ore contrattuali)
  scavalcaMezzanotte: boolean
  isNotte: boolean
  /** Posizione nella rotazione in avanti: M=1, P=2, N=3. null = fuori rotazione. */
  ordineRotazione: number | null
  contaNelleOre: boolean
  pesoOre: number
}

export interface Postazione {
  id: string
  nome: string
}

export interface Lavoratore {
  id: string
  nome: string
  cognome: string
  /** Monte ore contrattuale settimanale (38 = 2 mattini + 2 pomeriggi + 1 notte). */
  oreSettimanali: number
  riposoDopoNotteH: number
  maxGiorniConsecutivi: number
  /** Indici delle postazioni su cui è abilitato. */
  postazioniAbilitate: number[]
}

/** Uno slot da coprire: una persona richiesta in (data, postazione, turno). */
export interface Slot {
  idx: number
  giornoIdx: number
  data: string
  postazioneIdx: number
  turnoIdx: number
}

/** Assegnazione già esistente e immutabile (mese precedente, o bloccata a mano). */
export interface AssegnazioneFissa {
  data: string
  lavoratoreIdx: number
  turnoIdx: number
  postazioneIdx: number
  /** true = fa parte del mese pianificato ma l'utente l'ha bloccata */
  nelPeriodo: boolean
}

// ---------------------------------------------------------------------------
// Vincoli (DSL chiuso — vedi lib/ai/dsl.ts per la validazione)
// ---------------------------------------------------------------------------

export type KindVincolo =
  | "indisponibile"
  | "preferenza"
  | "turno_vietato"
  | "postazione_fissa"
  | "insieme"
  | "separati"
  | "max_turni"
  | "min_turni"
  | "ore_override"
  | "copertura_override"
  | "assegnazione_fissa"

export interface Vincolo {
  id: string
  kind: KindVincolo
  isHard: boolean
  peso: number
  descrizione: string
  validoDal?: string | null
  validoAl?: string | null
  /** Risolto in indici durante la costruzione del modello. */
  params: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Modello risolvibile
// ---------------------------------------------------------------------------

export interface Pesi {
  ore_target: number
  pattern_settimanale: number
  rotazione_avanti: number
  equita_notti: number
  equita_weekend: number
  equita_ore: number
  stabilita_postazione: number
  giorno_isolato: number
  riposo_isolato: number
  preferenze: number
}

export interface Regole {
  riposoMinOre: number
  riposoDopoNotteOre: number
  maxGiorniConsecutivi: number
  maxOreSettimana: number
}

export interface Modello {
  /** Primo giorno dell'orizzonte, INCLUSA la coda del mese precedente. */
  inizioOrizzonte: string
  /** Primo giorno del mese effettivamente pianificato. */
  inizioPeriodo: string
  finePeriodo: string
  nGiorni: number
  /** Indice (nell'orizzonte) del primo giorno del mese pianificato. */
  offsetPeriodo: number

  turni: TipoTurno[]
  postazioni: Postazione[]
  lavoratori: Lavoratore[]
  slots: Slot[]
  fisse: AssegnazioneFissa[]
  vincoli: Vincolo[]

  pesi: Pesi
  regole: Regole

  /** date[giornoIdx] = "2026-08-01" */
  date: string[]
  /** true se il giorno è festivo o domenica (per l'equità weekend/festivi). */
  giornoFestivo: boolean[]
  /** Indice della settimana ISO relativa, per i conteggi settimanali. */
  settimanaDi: number[]
  nSettimane: number

  /** inizioUtc[giornoIdx * nTurni + turnoIdx] — istante reale, per i riposi. */
  inizioUtc: Float64Array
  fineUtc: Float64Array

  /** assente[lavIdx * nGiorni + giornoIdx] = 1 se assente tutto il giorno. */
  assente: Uint8Array
  /** Assenze su singolo turno: chiave `${lavIdx}:${giornoIdx}:${turnoIdx}`. */
  assenteSuTurno: Set<string>

  /** abilitato[lavIdx * nPostazioni + postIdx] = 1 */
  abilitato: Uint8Array
}

// ---------------------------------------------------------------------------
// Stato e risultato
// ---------------------------------------------------------------------------

export interface Stato {
  /** assegnatoA[slotIdx] = indice lavoratore, oppure -1 se scoperto. */
  assegnatoA: Int32Array
  /** turnoDelGiorno[lavIdx * nGiorni + giornoIdx] = turnoIdx, -1 se libero. */
  turnoDelGiorno: Int32Array
  /** postazioneDelGiorno[...] = postazioneIdx, -1 se libero. */
  postazioneDelGiorno: Int32Array
  /** Slot bloccati dall'utente: non toccabili dalle mosse. */
  bloccato: Uint8Array
}

export type GravitaViolazione = "bloccante" | "avviso" | "info"

export interface Violazione {
  tipo: string
  gravita: GravitaViolazione
  messaggio: string
  data?: string
  lavoratoreIdx?: number
  riferimenti?: Record<string, unknown>
}

export interface RiepilogoLavoratore {
  lavoratoreIdx: number
  nome: string
  oreTotali: number
  oreTarget: number
  turniPerCodice: Record<string, number>
  notti: number
  weekendLavorati: number
  giorniLavorati: number
  orePerSettimana: number[]
}

export interface Risultato {
  stato: Stato
  costo: number
  costoHard: number
  costoSoft: number
  violazioni: Violazione[]
  riepiloghi: RiepilogoLavoratore[]
  slotScoperti: number
  iterazioni: number
  tempoMs: number
}
