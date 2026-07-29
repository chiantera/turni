import type { EsitoCompleto } from "./index"

export interface SnapshotSolver {
  versione: 2
  intervallo: { dal: string; al: string }
  improntaInput: string
  seme: number
  tempoMaxMs: number
  slotTotali: number
  slotScoperti: number
  iterazioni: number
  tempoMs: number
  costo: number
  qualitaRicerca: EsitoCompleto["qualitaRicerca"]
  fattibilita: EsitoCompleto["fattibilita"]
  riepiloghi: EsitoCompleto["riepiloghi"]
  violazioni: EsitoCompleto["violazioni"]
  vincoliApplicati: string[]
  vincoliNonApplicati: EsitoCompleto["vincoliNonApplicati"]
  vincoliFuoriPeriodo: EsitoCompleto["vincoliFuoriPeriodo"]
}

export function snapshotDaEsito(
  esito: EsitoCompleto,
  intervallo: { dal: string; al: string },
  improntaInput: string,
  seme: number,
  tempoMaxMs: number,
): SnapshotSolver {
  return {
    versione: 2,
    intervallo,
    improntaInput,
    seme,
    tempoMaxMs,
    slotTotali: esito.modello.slots.length,
    slotScoperti: esito.slotScoperti,
    iterazioni: esito.iterazioni,
    tempoMs: esito.tempoMs,
    costo: esito.costo,
    qualitaRicerca: esito.qualitaRicerca,
    fattibilita: esito.fattibilita,
    riepiloghi: esito.riepiloghi,
    violazioni: esito.violazioni.slice(0, 500),
    vincoliApplicati: esito.vincoliApplicati,
    vincoliNonApplicati: esito.vincoliNonApplicati,
    vincoliFuoriPeriodo: esito.vincoliFuoriPeriodo,
  }
}
