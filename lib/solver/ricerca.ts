/**
 * Ricerca locale (simulated annealing) per migliorare il piano iniziale.
 *
 * I vincoli rigidi restano invarianti: nessuna mossa viene applicata se
 * `puoAssegnare` la rifiuta. L'annealing lavora quindi solo sullo spazio delle
 * soluzioni ammissibili, ottimizzando copertura ed equilibrio.
 *
 * Quattro mosse, scelte perché coprono modi diversi di sbagliare:
 *
 *  - riassegna : cambia la persona su uno slot          (aggiusta i dettagli)
 *  - scambia   : due persone si scambiano il turno      (sblocca stalli)
 *  - copri     : riempie uno slot scoperto spostando qualcuno (catena)
 *  - scambiaGiorno : due persone si scambiano l'intera giornata
 *
 * Senza `copri` il solver non uscirebbe mai da una situazione in cui l'unico
 * candidato per una notte è già occupato altrove quel giorno.
 */

import { intero, type Casuale } from "./casuale"
import type { Modello, Stato } from "./tipi"
import {
  COSTO_SCOPERTO,
  assegna,
  costoEquita,
  costoLavoratore,
  libera,
  puoAssegnare,
  type VincoliCompilati,
} from "./vincoli"

export interface OpzioniRicerca {
  tempoMaxMs: number
  /** Budget deterministico; se presente ha precedenza sul tempo di parete. */
  iterazioniMax?: number
  /** Interrompe se non si migliora per N iterazioni consecutive. */
  stalloMax?: number
  temperaturaIniziale?: number
  temperaturaFinale?: number
}

export interface EsitoRicerca {
  iterazioni: number
  tempoMs: number
  costoFinale: number
  costoIniziale: number
  miglioramento: number
}

export function ottimizza(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  r: Casuale,
  opz: OpzioniRicerca,
): EsitoRicerca {
  const nL = m.lavoratori.length
  const nSlot = m.slots.length
  const t0 = Date.now()

  const T0 = opz.temperaturaIniziale ?? 800
  const T1 = opz.temperaturaFinale ?? 0.5
  const stalloMax = opz.stalloMax ?? 60_000
  const iterazioniMax =
    opz.iterazioniMax === undefined
      ? undefined
      : Number.isFinite(opz.iterazioniMax)
        ? Math.max(0, Math.floor(opz.iterazioniMax))
        : 0

  // Costo corrente scomposto, così una mossa che tocca 2 lavoratori ricalcola
  // solo 2 voci invece di tutte.
  const costoLav = new Float64Array(nL)
  for (let l = 0; l < nL; l++) costoLav[l] = costoLavoratore(m, s, c, l)
  let sommaLav = 0
  for (let l = 0; l < nL; l++) sommaLav += costoLav[l]
  let scoperti = 0
  for (let i = 0; i < nSlot; i++) if (s.assegnatoA[i] === -1) scoperti++
  let equita = costoEquita(m, s, c)
  let costo = sommaLav + equita + scoperti * COSTO_SCOPERTO
  const costoIniziale = costo

  // Migliore soluzione vista: l'annealing accetta anche peggioramenti, quindi
  // lo stato finale non è per forza il migliore incontrato.
  let miglioreCosto = costo
  let miglioreStato = clonaStato(s)

  const slotModificabili: number[] = []
  for (let i = 0; i < nSlot; i++) if (!s.bloccato[i]) slotModificabili.push(i)
  if (slotModificabili.length === 0) {
    return {
      iterazioni: 0,
      tempoMs: Date.now() - t0,
      costoFinale: costo,
      costoIniziale,
      miglioramento: 0,
    }
  }

  let iter = 0
  let stallo = 0
  let T = T0
  const decadimento = 0.99995

  while (
    (iterazioniMax !== undefined
      ? iter < iterazioniMax
      : Date.now() - t0 < opz.tempoMaxMs) &&
    stallo < stalloMax
  ) {
    iter++
    T = Math.max(T1, T * decadimento)

    const tocchi: number[] = []
    const ripristino = tentaMossa(m, s, c, r, slotModificabili, tocchi)
    if (!ripristino) {
      stallo++
      continue
    }

    // Ricalcolo solo ciò che è cambiato.
    let nuovaSommaLav = sommaLav
    for (const l of tocchi) {
      const nuovo = costoLavoratore(m, s, c, l)
      nuovaSommaLav += nuovo - costoLav[l]
    }
    let nuoviScoperti = 0
    for (let i = 0; i < nSlot; i++) if (s.assegnatoA[i] === -1) nuoviScoperti++
    const nuovaEquita = costoEquita(m, s, c)
    const nuovoCosto =
      nuovaSommaLav + nuovaEquita + nuoviScoperti * COSTO_SCOPERTO

    const delta = nuovoCosto - costo
    const accetta = delta <= 0 || r() < Math.exp(-delta / T)

    if (accetta) {
      for (const l of tocchi) costoLav[l] = costoLavoratore(m, s, c, l)
      sommaLav = nuovaSommaLav
      equita = nuovaEquita
      scoperti = nuoviScoperti
      costo = nuovoCosto
      if (costo < miglioreCosto - 1e-9) {
        miglioreCosto = costo
        miglioreStato = clonaStato(s)
        stallo = 0
      } else {
        stallo++
      }
    } else {
      ripristino()
      stallo++
    }
  }

  copiaStato(miglioreStato, s)
  void equita
  void scoperti
  return {
    iterazioni: iter,
    tempoMs: Date.now() - t0,
    costoFinale: miglioreCosto,
    costoIniziale,
    miglioramento: costoIniziale - miglioreCosto,
  }
}

// ---------------------------------------------------------------------------
// Mosse
// ---------------------------------------------------------------------------

type Ripristino = (() => void) | null

function tentaMossa(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  r: Casuale,
  slotModificabili: number[],
  tocchi: number[],
): Ripristino {
  const dado = r()
  if (dado < 0.35) return mossaRiassegna(m, s, c, r, slotModificabili, tocchi)
  if (dado < 0.65) return mossaScambia(m, s, c, r, slotModificabili, tocchi)
  if (dado < 0.85) return mossaCopri(m, s, c, r, tocchi)
  return mossaScambiaGiorno(m, s, c, r, tocchi)
}

/** Cambia la persona assegnata a uno slot. */
function mossaRiassegna(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  r: Casuale,
  slotModificabili: number[],
  tocchi: number[],
): Ripristino {
  const slotIdx = slotModificabili[intero(r, slotModificabili.length)]
  const precedente = s.assegnatoA[slotIdx]
  const nuovo = intero(r, m.lavoratori.length)
  if (nuovo === precedente) return null

  if (precedente >= 0) libera(m, s, slotIdx)
  if (!puoAssegnare(m, s, c, slotIdx, nuovo)) {
    if (precedente >= 0) assegna(m, s, slotIdx, precedente)
    return null
  }
  assegna(m, s, slotIdx, nuovo)

  tocchi.push(nuovo)
  if (precedente >= 0) tocchi.push(precedente)
  return () => {
    libera(m, s, slotIdx)
    if (precedente >= 0) assegna(m, s, slotIdx, precedente)
  }
}

/** Due slot si scambiano le persone. */
function mossaScambia(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  r: Casuale,
  slotModificabili: number[],
  tocchi: number[],
): Ripristino {
  const a = slotModificabili[intero(r, slotModificabili.length)]
  const b = slotModificabili[intero(r, slotModificabili.length)]
  if (a === b) return null
  const la = s.assegnatoA[a]
  const lb = s.assegnatoA[b]
  if (la === lb) return null
  if (la < 0 && lb < 0) return null

  if (la >= 0) libera(m, s, a)
  if (lb >= 0) libera(m, s, b)

  const okA = lb < 0 || puoAssegnare(m, s, c, a, lb)
  if (!okA) {
    if (la >= 0) assegna(m, s, a, la)
    if (lb >= 0) assegna(m, s, b, lb)
    return null
  }
  if (lb >= 0) assegna(m, s, a, lb)

  const okB = la < 0 || puoAssegnare(m, s, c, b, la)
  if (!okB) {
    if (lb >= 0) libera(m, s, a)
    if (la >= 0) assegna(m, s, a, la)
    if (lb >= 0) assegna(m, s, b, lb)
    return null
  }
  if (la >= 0) assegna(m, s, b, la)

  if (la >= 0) tocchi.push(la)
  if (lb >= 0) tocchi.push(lb)
  return () => {
    if (lb >= 0) libera(m, s, a)
    if (la >= 0) libera(m, s, b)
    if (la >= 0) assegna(m, s, a, la)
    if (lb >= 0) assegna(m, s, b, lb)
  }
}

/**
 * Riempie uno slot scoperto liberando una persona da un altro turno dello
 * stesso giorno, e prova a ricoprire lo slot lasciato libero.
 * È la mossa che sblocca gli stalli di copertura.
 */
function mossaCopri(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  r: Casuale,
  tocchi: number[],
): Ripristino {
  const scoperti: number[] = []
  for (let i = 0; i < m.slots.length; i++) {
    if (s.assegnatoA[i] === -1 && !s.bloccato[i]) scoperti.push(i)
  }
  if (scoperti.length === 0) return null

  const target = scoperti[intero(r, scoperti.length)]
  const giorno = m.slots[target].giornoIdx

  // Slot dello stesso giorno da cui "rubare" una persona.
  const donatori: number[] = []
  for (let i = 0; i < m.slots.length; i++) {
    if (m.slots[i].giornoIdx !== giorno) continue
    if (s.assegnatoA[i] < 0 || s.bloccato[i]) continue
    donatori.push(i)
  }
  if (donatori.length === 0) return null

  const donatore = donatori[intero(r, donatori.length)]
  const lav = s.assegnatoA[donatore]

  libera(m, s, donatore)
  if (!puoAssegnare(m, s, c, target, lav)) {
    assegna(m, s, donatore, lav)
    return null
  }
  assegna(m, s, target, lav)
  tocchi.push(lav)

  // Provo a ricoprire lo slot appena liberato, così la mossa può guadagnare
  // copertura netta invece di limitarsi a spostarla.
  let sostituto = -1
  const partenza = intero(r, m.lavoratori.length)
  for (let k = 0; k < m.lavoratori.length; k++) {
    const l = (partenza + k) % m.lavoratori.length
    if (l === lav) continue
    if (puoAssegnare(m, s, c, donatore, l)) {
      sostituto = l
      break
    }
  }
  if (sostituto >= 0) {
    assegna(m, s, donatore, sostituto)
    tocchi.push(sostituto)
  }

  return () => {
    if (sostituto >= 0) libera(m, s, donatore)
    libera(m, s, target)
    assegna(m, s, donatore, lav)
  }
}

/** Due persone si scambiano l'intera giornata (turno + postazione). */
function mossaScambiaGiorno(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  r: Casuale,
  tocchi: number[],
): Ripristino {
  const giorno =
    m.offsetPeriodo + intero(r, m.fineOffsetPeriodo - m.offsetPeriodo)
  const delGiorno: number[] = []
  for (let i = 0; i < m.slots.length; i++) {
    if (m.slots[i].giornoIdx === giorno && !s.bloccato[i]) delGiorno.push(i)
  }
  if (delGiorno.length < 2) return null

  const a = delGiorno[intero(r, delGiorno.length)]
  const b = delGiorno[intero(r, delGiorno.length)]
  if (a === b) return null
  const la = s.assegnatoA[a]
  const lb = s.assegnatoA[b]
  if (la < 0 || lb < 0 || la === lb) return null

  libera(m, s, a)
  libera(m, s, b)
  if (!puoAssegnare(m, s, c, a, lb) || !puoAssegnare(m, s, c, b, la)) {
    assegna(m, s, a, la)
    assegna(m, s, b, lb)
    return null
  }
  assegna(m, s, a, lb)
  assegna(m, s, b, la)
  tocchi.push(la, lb)
  return () => {
    libera(m, s, a)
    libera(m, s, b)
    assegna(m, s, a, la)
    assegna(m, s, b, lb)
  }
}

// ---------------------------------------------------------------------------

export function clonaStato(s: Stato): Stato {
  return {
    assegnatoA: s.assegnatoA.slice(),
    turnoDelGiorno: s.turnoDelGiorno.slice(),
    postazioneDelGiorno: s.postazioneDelGiorno.slice(),
    bloccato: s.bloccato.slice(),
  }
}

export function copiaStato(da: Stato, a: Stato): void {
  a.assegnatoA.set(da.assegnatoA)
  a.turnoDelGiorno.set(da.turnoDelGiorno)
  a.postazioneDelGiorno.set(da.postazioneDelGiorno)
  a.bloccato.set(da.bloccato)
}
