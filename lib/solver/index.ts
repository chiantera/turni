/**
 * Punto di ingresso del solver.
 *
 *   dati grezzi -> modello -> fattibilità -> greedy -> ricerca locale -> esito
 *
 * L'AI non entra qui: i vincoli arrivano già strutturati e validati. Questo
 * modulo è deterministico e testabile senza rete.
 */

import { creaCasuale } from "./casuale"
import { costruisciCiclicamente } from "./ciclico"
import { verificaFattibilita, type Fattibilita } from "./fattibilita"
import { costruisciGreedy } from "./greedy"
import { costruisciModello, type DatiIngresso } from "./modello"
import { ottimizza, type EsitoRicerca } from "./ricerca"
import type { Modello, Risultato, Stato } from "./tipi"
import {
  compilaVincoli,
  costoTotale,
  creaStato,
  riepiloghi,
  trovaViolazioni,
} from "./vincoli"
export { valutaAssegnabilita } from "./vincoli"
export type { MotivoAssegnabilita, ValutazioneAssegnabilita } from "./vincoli"

export * from "./tipi"
export { costruisciModello, PESI_DEFAULT, REGOLE_DEFAULT } from "./modello"
export type { DatiIngresso } from "./modello"
export {
  valutaRilassamenti,
  type EsitoControfattuale,
  type OpzioniControfattuali,
} from "./controfattuali"
export { verificaFattibilita } from "./fattibilita"
export type { Fattibilita } from "./fattibilita"
export * from "./tempo"

export interface OpzioniSolver {
  seme?: number
  tempoMaxMs?: number
  iterazioniMax?: number
}

export interface EsitoCompleto extends Risultato {
  modello: Modello
  fattibilita: Fattibilita
  qualitaRicerca: EsitoRicerca
  /** ID dei vincoli che il solver ha davvero applicato. */
  vincoliApplicati: string[]
  /** Vincoli accettati dall'interfaccia ma non applicati, con il motivo. */
  vincoliNonApplicati: {
    id: string
    kind: string
    descrizione: string
    motivo: string
  }[]
  /** Vincoli validi che però non riguardano l'intervallo pianificato. */
  vincoliFuoriPeriodo: { id: string; kind: string; descrizione: string }[]
}

/** Genera un piano turni a partire dai dati grezzi. */
export function generaPiano(
  dati: DatiIngresso,
  opz: OpzioniSolver = {},
): EsitoCompleto {
  const m = costruisciModello(dati)
  return risolviModello(m, opz)
}

/** Come `generaPiano` ma su un modello già costruito (utile nei test). */
export function risolviModello(
  m: Modello,
  opz: OpzioniSolver = {},
): EsitoCompleto {
  const seme = opz.seme ?? 1
  const tempoMaxMs = opz.tempoMaxMs ?? 10_000
  const t0 = Date.now()

  const fattibilita = verificaFattibilita(m)
  const c = compilaVincoli(m)
  const r = creaCasuale(seme)
  const s = creaStato(m)

  // Tre fasi, dalla più strutturata alla più opportunistica:
  //   1. ciclo a squadre  -> la rotazione canonica, dove la domanda lo consente
  //   2. greedy           -> riempie ciò che il ciclo non ha coperto
  //   3. ricerca locale   -> adatta a assenze, vincoli e festività
  costruisciCiclicamente(m, s, c, r)
  costruisciGreedy(m, s, c, r)
  const esito = ottimizza(m, s, c, r, {
    tempoMaxMs,
    iterazioniMax: opz.iterazioniMax,
  })

  return componiRisultato(m, s, c, {
    iterazioni: esito.iterazioni,
    tempoMs: Date.now() - t0,
    fattibilita,
    qualitaRicerca: esito,
  })
}

/**
 * Riparazione incrementale: si riottimizza tenendo bloccato tutto ciò che
 * l'utente ha fissato a mano. Serve dopo una modifica manuale o l'aggiunta di
 * un vincolo, per non stravolgere un mese già rivisto.
 */
export function riparaPiano(
  dati: DatiIngresso,
  opz: OpzioniSolver = {},
): EsitoCompleto {
  const m = costruisciModello(dati)
  const fattibilita = verificaFattibilita(m)
  const c = compilaVincoli(m)
  const r = creaCasuale(opz.seme ?? 1)
  const s = creaStato(m)
  const t0 = Date.now()

  costruisciCiclicamente(m, s, c, r)
  costruisciGreedy(m, s, c, r)
  const esito = ottimizza(m, s, c, r, {
    tempoMaxMs: opz.tempoMaxMs ?? 5_000,
    iterazioniMax: opz.iterazioniMax,
  })

  return componiRisultato(m, s, c, {
    iterazioni: esito.iterazioni,
    tempoMs: Date.now() - t0,
    fattibilita,
    qualitaRicerca: esito,
  })
}

function componiRisultato(
  m: Modello,
  s: Stato,
  c: ReturnType<typeof compilaVincoli>,
  extra: {
    iterazioni: number
    tempoMs: number
    fattibilita: Fattibilita
    qualitaRicerca: EsitoRicerca
  },
): EsitoCompleto {
  const costo = costoTotale(m, s, c)
  const violazioni = trovaViolazioni(m, s, c)
  return {
    modello: m,
    stato: s,
    costo: costo.totale,
    costoHard: costo.scoperti,
    costoSoft: costo.totale - costo.scoperti * 100_000,
    violazioni,
    riepiloghi: riepiloghi(m, s, c),
    slotScoperti: costo.scoperti,
    iterazioni: extra.iterazioni,
    tempoMs: extra.tempoMs,
    fattibilita: extra.fattibilita,
    qualitaRicerca: extra.qualitaRicerca,
    vincoliApplicati: [...c.applicati],
    vincoliNonApplicati: c.nonApplicati,
    vincoliFuoriPeriodo: c.fuoriPeriodo,
  }
}

/** Estrae le assegnazioni in forma serializzabile, pronte per il salvataggio. */
export function estraiAssegnazioni(m: Modello, s: Stato) {
  const out: {
    data: string
    worker_id: string
    shift_type_id: string
    position_id: string
    bloccato: boolean
  }[] = []
  for (const sl of m.slots) {
    const l = s.assegnatoA[sl.idx]
    if (l < 0) continue
    out.push({
      data: sl.data,
      worker_id: m.lavoratori[l].id,
      shift_type_id: m.turni[sl.turnoIdx].id,
      position_id: m.postazioni[sl.postazioneIdx].id,
      bloccato: s.bloccato[sl.idx] === 1,
    })
  }
  return out
}

/** Griglia per la vista "per lavoratore": codice turno per giorno. */
export function grigliaPerLavoratore(m: Modello, s: Stato) {
  return m.lavoratori.map((l, li) => ({
    lavoratore: l,
    giorni: m.date.slice(m.offsetPeriodo, m.fineOffsetPeriodo).map((data, i) => {
      const g = m.offsetPeriodo + i
      const t = s.turnoDelGiorno[li * m.nGiorni + g]
      const p = s.postazioneDelGiorno[li * m.nGiorni + g]
      return {
        data,
        codice: t >= 0 ? m.turni[t].codice : null,
        colore: t >= 0 ? undefined : undefined,
        turnoIdx: t,
        postazione: p >= 0 ? m.postazioni[p].nome : null,
        festivo: m.giornoFestivo[g],
      }
    }),
  }))
}
