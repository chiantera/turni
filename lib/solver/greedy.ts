/**
 * Costruzione iniziale del piano (euristica greedy).
 *
 * Strategia "most constrained first": si assegnano prima gli slot con meno
 * candidati possibili. Riempire prima i mattini — che quasi tutti possono
 * fare — lascerebbe le notti senza nessuno disponibile, perché il riposo di
 * 48h dopo la notte esclude molte persone già impegnate.
 *
 * L'ordine effettivo è: giorno per giorno (la sequenza conta per i riposi),
 * e dentro il giorno prima le notti, poi i pomeriggi, poi i mattini.
 */

import { intero, mescola, type Casuale } from "./casuale"
import type { Modello, Stato } from "./tipi"
import {
  assegna,
  costoLavoratore,
  MIN_IN_H,
  minutiAssegnatiPeriodo,
  puoAssegnare,
  targetMinutiPeriodo,
  type VincoliCompilati,
} from "./vincoli"

export function costruisciGreedy(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  r: Casuale,
): void {
  const nL = m.lavoratori.length

  // Slot ordinati: prima per giorno, poi per "difficoltà" del turno.
  // ordineRotazione decrescente mette la notte (3) prima del mattino (1).
  const ordine = m.slots
    .filter((sl) => s.assegnatoA[sl.idx] === -1)
    .sort((a, b) => {
      if (a.giornoIdx !== b.giornoIdx) return a.giornoIdx - b.giornoIdx
      const oa = m.turni[a.turnoIdx].ordineRotazione ?? 0
      const ob = m.turni[b.turnoIdx].ordineRotazione ?? 0
      if (oa !== ob) return ob - oa
      return a.postazioneIdx - b.postazioneIdx
    })

  // Cache dei costi per lavoratore: ricalcolare tutti i 21 costi per ogni
  // candidato di ogni slot sarebbe quadratico senza motivo.
  const costoCorrente = new Float64Array(nL)
  for (let l = 0; l < nL; l++) costoCorrente[l] = costoLavoratore(m, s, c, l)

  // Carico relativo al contratto, mantenuto incrementale come i costi.
  //
  // `costoLavoratore` tira ognuno verso il PROPRIO monte ore, ma non guarda
  // mai come stanno gli altri: fra due candidati ugualmente ammissibili la
  // scelta finiva ai pareggi, rotti da `mescola` — cioè a caso. Qui vince chi
  // è più indietro rispetto al proprio contratto.
  //
  // Il termine è un valore per-candidato, quindi confrontarlo dentro lo stesso
  // slot è esattamente la preferenza voluta, e resta O(1): ricalcolare
  // `costoEquita()` per ogni candidato sarebbe quadratico, che è il motivo per
  // cui esiste la cache qui sopra.
  const targetMin = new Float64Array(nL)
  const minutiCorrenti = new Float64Array(nL)
  for (let l = 0; l < nL; l++) {
    targetMin[l] = targetMinutiPeriodo(m, c, l)
    minutiCorrenti[l] = minutiAssegnatiPeriodo(m, s, l)
  }

  for (const sl of ordine) {
    const candidati: number[] = []
    for (let l = 0; l < nL; l++) {
      if (puoAssegnare(m, s, c, sl.idx, l)) candidati.push(l)
    }
    if (candidati.length === 0) continue // slot scoperto: verrà segnalato

    mescola(r, candidati) // rompe i pareggi in modo deterministico ma non biased

    let migliore = -1
    let miglioreDelta = Infinity
    for (const l of candidati) {
      assegna(m, s, sl.idx, l)
      const nuovo = costoLavoratore(m, s, c, l)
      const squilibrio = ((minutiCorrenti[l] - targetMin[l]) / MIN_IN_H) * m.pesi.equita_ore
      const delta = nuovo - costoCorrente[l] + squilibrio
      // Ripristino subito: la valutazione dev'essere senza effetti collaterali.
      s.assegnatoA[sl.idx] = -1
      s.turnoDelGiorno[l * m.nGiorni + sl.giornoIdx] = -1
      s.postazioneDelGiorno[l * m.nGiorni + sl.giornoIdx] = -1

      if (delta < miglioreDelta) {
        miglioreDelta = delta
        migliore = l
      }
    }

    if (migliore >= 0) {
      assegna(m, s, sl.idx, migliore)
      costoCorrente[migliore] = costoLavoratore(m, s, c, migliore)
      const tt = m.turni[sl.turnoIdx]
      // Solo i giorni dentro il periodo: l'orizzonte include giorni di
      // contesto per la continuità della rotazione, che non sono ore nostre.
      if (
        tt.contaNelleOre &&
        sl.giornoIdx >= m.offsetPeriodo &&
        sl.giornoIdx < m.fineOffsetPeriodo
      ) {
        minutiCorrenti[migliore] += tt.durataMin * tt.pesoOre
      }
    }
  }

  void intero
}
