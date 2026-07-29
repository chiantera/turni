/**
 * Verifica di fattibilità, da eseguire PRIMA di risolvere.
 *
 * Il caso che manda in crisi i pianificatori non è il totale sbagliato: è il
 * MIX sbagliato. Con il ciclo canonico ogni persona produce 2 mattini,
 * 2 pomeriggi e 1 notte a settimana. Se il fabbisogno chiede un rapporto
 * diverso — per esempio 1 persona per turno, cioè 1:1:1 — il monte ore totale
 * può tornare perfettamente mentre le notti restano scoperte.
 *
 * Perciò il controllo si fa per singolo turno, non solo sul totale, e il
 * risultato viene mostrato prima di generare: un buco di organico non deve
 * sembrare un difetto del solver.
 */

import { formattaOre } from "./tempo"
import type { Modello } from "./tipi"

export interface VoceFabbisogno {
  turno: string
  codice: string
  slotRichiesti: number
  oreRichieste: number
  /** Persone teoriche necessarie se ognuna facesse solo questo turno. */
  personeEquivalenti: number
}

export interface Fattibilita {
  ok: boolean
  oreRichieste: number
  oreDisponibili: number
  scartoOre: number
  /** Organico mancante (arrotondato per eccesso), 0 se sufficiente. */
  personeMancanti: number
  perTurno: VoceFabbisogno[]
  /** Ripartizione ideale delle notti se distribuite equamente. */
  nottiPerPersona: number
  avvisi: string[]
}

export function verificaFattibilita(m: Modello): Fattibilita {
  const giorniPeriodo = m.nGiorni - m.offsetPeriodo
  const settimane = giorniPeriodo / 7

  // --- Fabbisogno per turno ------------------------------------------------
  const perTurnoMap = new Map<number, VoceFabbisogno>()
  let oreRichieste = 0
  let slotNotte = 0

  for (const sl of m.slots) {
    const t = m.turni[sl.turnoIdx]
    const ore = (t.durataMin * t.pesoOre) / 60
    oreRichieste += ore
    if (t.isNotte) slotNotte++

    let v = perTurnoMap.get(sl.turnoIdx)
    if (!v) {
      v = {
        turno: t.nome,
        codice: t.codice,
        slotRichiesti: 0,
        oreRichieste: 0,
        personeEquivalenti: 0,
      }
      perTurnoMap.set(sl.turnoIdx, v)
    }
    v.slotRichiesti++
    v.oreRichieste += ore
  }

  // --- Ore disponibili, al netto delle assenze -----------------------------
  let oreDisponibili = 0
  let oreAssenze = 0
  for (let l = 0; l < m.lavoratori.length; l++) {
    const L = m.lavoratori[l]
    const oreNominali = (L.oreSettimanali * giorniPeriodo) / 7
    let giorniAssenti = 0
    for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
      if (m.assente[l * m.nGiorni + g]) giorniAssenti++
    }
    // Un giorno di assenza sottrae la quota giornaliera del monte ore.
    const perse = (L.oreSettimanali / 7) * giorniAssenti
    oreAssenze += perse
    oreDisponibili += oreNominali - perse
  }

  const scarto = oreDisponibili - oreRichieste
  const oreMediePersona =
    m.lavoratori.length > 0
      ? (m.lavoratori.reduce((a, l) => a + l.oreSettimanali, 0) /
          m.lavoratori.length) *
        settimane
      : 38 * settimane
  const personeMancanti = scarto >= 0 ? 0 : Math.ceil(-scarto / oreMediePersona)

  const perTurno = [...perTurnoMap.values()]
  for (const v of perTurno) {
    v.personeEquivalenti = oreMediePersona > 0 ? v.oreRichieste / oreMediePersona : 0
  }

  // --- Avvisi --------------------------------------------------------------
  const avvisi: string[] = []

  if (scarto < 0) {
    avvisi.push(
      `Organico insufficiente: servono ${formattaOre(oreRichieste * 60)} ma ne sono disponibili ${formattaOre(oreDisponibili * 60)}. ` +
        `Mancano circa ${personeMancanti} ${personeMancanti === 1 ? "persona" : "persone"}: il piano avrà turni scoperti.`,
    )
  }

  // Controllo del MIX: le notti sono la risorsa scarsa.
  const nottiPerPersona =
    m.lavoratori.length > 0 ? slotNotte / m.lavoratori.length : 0
  const nottiCanoniche = settimane // 1 notte a settimana nel ciclo canonico
  if (nottiPerPersona > nottiCanoniche * 1.25) {
    avvisi.push(
      `Mix sbilanciato: servono ${slotNotte} turni di notte, cioè ${nottiPerPersona.toFixed(1)} a persona, ` +
        `contro le ${nottiCanoniche.toFixed(1)} previste dal ciclo 2 mattini + 2 pomeriggi + 1 notte. ` +
        `Il monte ore può anche tornare, ma le notti resteranno difficili da coprire: ` +
        `valuta di aumentare la copertura diurna o di ridurre le postazioni presidiate di notte.`,
    )
  }

  if (scarto >= 0 && scarto < oreMediePersona * 0.15) {
    avvisi.push(
      `Nessun margine: le ore disponibili coprono il fabbisogno quasi esattamente (${formattaOre(scarto * 60)} di scorta). ` +
        `Qualsiasi malattia o permesso non pianificato creerà un buco.`,
    )
  }

  if (oreAssenze > 0) {
    avvisi.push(
      `Le assenze registrate sottraggono ${formattaOre(oreAssenze * 60)} al monte ore del periodo.`,
    )
  }

  // Copertura teoricamente impossibile su una postazione senza abilitati
  for (let p = 0; p < m.postazioni.length; p++) {
    let abilitati = 0
    for (let l = 0; l < m.lavoratori.length; l++) {
      if (m.abilitato[l * m.postazioni.length + p]) abilitati++
    }
    const slotPost = m.slots.filter((s) => s.postazioneIdx === p).length
    if (slotPost > 0 && abilitati === 0) {
      avvisi.push(
        `Nessun lavoratore è abilitato su "${m.postazioni[p].nome}": tutti i suoi turni resteranno scoperti.`,
      )
    }
  }

  return {
    ok: scarto >= 0 && avvisi.length === 0,
    oreRichieste,
    oreDisponibili,
    scartoOre: scarto,
    personeMancanti,
    perTurno,
    nottiPerPersona,
    avvisi,
  }
}
