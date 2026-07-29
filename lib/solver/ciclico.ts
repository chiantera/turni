/**
 * Costruzione ciclica: il "ciclo a squadre".
 *
 * Perché esiste questo modulo. Nella configurazione di riferimento — una
 * postazione che richiede 2 mattini, 2 pomeriggi e 1 notte al giorno, servita
 * da 7 persone a 38 ore — lo scarto fra ore richieste e ore disponibili è
 * ESATTAMENTE ZERO. Ogni persona deve fare precisamente 5 turni a settimana,
 * di cui una notte, e non esiste alcun margine di manovra.
 *
 * Una ricerca casuale, per quanto ben guidata, fatica a trovare l'unica
 * soluzione ammissibile in uno spazio così stretto: basta un passo storto e le
 * notti restano scoperte. Ma la soluzione ottima ha una forma nota da sempre
 * ai pianificatori di turni:
 *
 *     ciclo:  M  M  P  P  N  R  R        (7 giorni, 38 ore)
 *     persona j al giorno g -> ciclo[(g + j) mod 7]
 *
 * Con 7 persone sfasate di un giorno l'una dall'altra, ogni giorno le 7 fasi
 * del ciclo sono occupate tutte e una sola volta: 2 in mattino, 2 in
 * pomeriggio, 1 in notte, 2 a riposo. La copertura torna esatta per
 * costruzione, la rotazione è in avanti, e dopo la notte seguono due riposi
 * (48 ore esatte).
 *
 * Questo modulo ricava quel ciclo dai dati invece di darlo per scontato, e lo
 * usa come punto di partenza. La ricerca locale interviene dopo, per adattarlo
 * ad assenze, vincoli e festività — cioè per fare ciò in cui è brava.
 */

import { mescola, type Casuale } from "./casuale"
import type { Modello, Stato } from "./tipi"
import { assegna, puoAssegnare, type VincoliCompilati } from "./vincoli"

export interface EsitoCiclico {
  applicato: boolean
  motivo?: string
  /** Lunghezza del ciclo per ciascuna postazione. */
  lunghezzaCiclo: number[]
  assegnati: number
}

/** Domanda giornaliera di una postazione: quante persone per ciascun turno. */
function domandaGiornaliera(m: Modello, postIdx: number): Map<number, number>[] {
  const perGiorno: Map<number, number>[] = []
  for (let g = 0; g < m.nGiorni; g++) perGiorno.push(new Map())
  for (const sl of m.slots) {
    if (sl.postazioneIdx !== postIdx) continue
    const mm = perGiorno[sl.giornoIdx]
    mm.set(sl.turnoIdx, (mm.get(sl.turnoIdx) ?? 0) + 1)
  }
  return perGiorno
}

/**
 * Costruisce il ciclo canonico per una domanda giornaliera data.
 * Restituisce un array di lunghezza L dove ogni voce è un indice di turno
 * oppure -1 per il riposo.
 */
export function costruisciCiclo(
  m: Modello,
  domanda: Map<number, number>,
  oreSettimanali: number,
): number[] | null {
  // Turni ordinati secondo la rotazione in avanti: M, poi P, poi N.
  const voci = [...domanda.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => {
      const oa = m.turni[a[0]].ordineRotazione ?? 99
      const ob = m.turni[b[0]].ordineRotazione ?? 99
      return oa - ob
    })
  if (voci.length === 0) return null

  const sequenza: number[] = []
  let minutiCiclo = 0
  for (const [turnoIdx, n] of voci) {
    for (let k = 0; k < n; k++) {
      sequenza.push(turnoIdx)
      const t = m.turni[turnoIdx]
      if (t.contaNelleOre) minutiCiclo += t.durataMin * t.pesoOre
    }
  }

  // Lunghezza del ciclo: quella che porta la media settimanale sul monte ore.
  //   minutiCiclo / L * 7 = oreSettimanali * 60   ->   L = minutiCiclo*7 / (ore*60)
  const minutiAlGiorno = (oreSettimanali * 60) / 7
  const L = Math.round(minutiCiclo / minutiAlGiorno)

  // Il ciclo deve avere almeno un giorno di riposo in più dei giorni lavorati,
  // altrimenti non è un ciclo valido.
  if (L < sequenza.length + 1) return null
  // Serie di lavoro più lunga del consentito: il ciclo non è praticabile.
  if (sequenza.length > m.regole.maxGiorniConsecutivi) return null

  const ciclo = sequenza.slice()
  while (ciclo.length < L) ciclo.push(-1) // riposi in coda, dopo la notte
  return ciclo
}

/**
 * Applica la costruzione ciclica. Assegna solo dove `puoAssegnare` acconsente:
 * assenze e vincoli hanno la precedenza sul ciclo, e i buchi che ne risultano
 * vengono lasciati alla ricerca locale.
 */
export function costruisciCiclicamente(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  r: Casuale,
): EsitoCiclico {
  const nL = m.lavoratori.length
  const lunghezze: number[] = []
  let assegnati = 0

  // Lavoratori non ancora impegnati in un gruppo.
  const disponibili = mescola(
    r,
    Array.from({ length: nL }, (_, i) => i),
  )
  const usati = new Set<number>()

  // Postazioni in ordine di domanda decrescente: le più esigenti prima,
  // così ricevono il personale mentre ce n'è ancora.
  const ordinePost = Array.from({ length: m.postazioni.length }, (_, i) => i)

  for (const p of ordinePost) {
    const perGiorno = domandaGiornaliera(m, p)
    // Giorno rappresentativo: il primo del periodo pianificato.
    const rappresentativo = perGiorno[m.offsetPeriodo]
    if (!rappresentativo || rappresentativo.size === 0) {
      lunghezze.push(0)
      continue
    }

    // Monte ore di riferimento: la media della squadra disponibile.
    const oreMedie =
      nL > 0
        ? m.lavoratori.reduce((a, l) => a + l.oreSettimanali, 0) / nL
        : 38
    const ciclo = costruisciCiclo(m, rappresentativo, oreMedie)
    if (!ciclo) {
      lunghezze.push(0)
      continue
    }
    const L = ciclo.length
    lunghezze.push(L)

    // Squadra: L persone abilitate su questa postazione e non ancora usate.
    const squadra: number[] = []
    for (const l of disponibili) {
      if (usati.has(l)) continue
      if (!m.abilitato[l * m.postazioni.length + p]) continue
      squadra.push(l)
      if (squadra.length === L) break
    }
    if (squadra.length < L) {
      // Organico insufficiente per un ciclo completo: lascio fare al greedy.
      continue
    }
    for (const l of squadra) usati.add(l)

    // Sfasamento: la persona j al giorno g sta nella fase (g + j) mod L.
    // L'offset di partenza è calibrato sul primo giorno del periodo.
    for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
      const giorniDaInizio = g - m.offsetPeriodo
      for (let j = 0; j < L; j++) {
        const turnoIdx = ciclo[(giorniDaInizio + j) % L]
        if (turnoIdx < 0) continue // giorno di riposo
        const lav = squadra[j]

        // Slot libero corrispondente (postazione + turno + giorno).
        const slot = m.slots.find(
          (sl) =>
            sl.giornoIdx === g &&
            sl.postazioneIdx === p &&
            sl.turnoIdx === turnoIdx &&
            s.assegnatoA[sl.idx] === -1,
        )
        if (!slot) continue
        if (!puoAssegnare(m, s, c, slot.idx, lav)) continue
        assegna(m, s, slot.idx, lav)
        assegnati++
      }
    }
  }

  return {
    applicato: assegnati > 0,
    lunghezzaCiclo: lunghezze,
    assegnati,
  }
}
