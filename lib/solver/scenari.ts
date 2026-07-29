/**
 * Costruttori di scenari per i test.
 *
 * Riproducono la configurazione di riferimento: postazioni coperte 24/7 con
 * fabbisogno 2 mattini / 2 pomeriggi / 1 notte, servite da 7 lavoratori per
 * postazione (il "ciclo a 7 squadre").
 */

import { PESI_DEFAULT, REGOLE_DEFAULT, type DatiIngresso } from "./modello"
import type { Vincolo } from "./tipi"

export const TURNI_STANDARD = [
  {
    id: "t-m",
    codice: "M",
    nome: "Mattino",
    ora_inizio: "07:00",
    durata_min: 420,
    scavalca_mezzanotte: false,
    is_notte: false,
    ordine_rotazione: 1,
    conta_nelle_ore: true,
    peso_ore: 1,
  },
  {
    id: "t-p",
    codice: "P",
    nome: "Pomeriggio",
    ora_inizio: "14:00",
    durata_min: 420,
    scavalca_mezzanotte: false,
    is_notte: false,
    ordine_rotazione: 2,
    conta_nelle_ore: true,
    peso_ore: 1,
  },
  {
    id: "t-n",
    codice: "N",
    nome: "Notte",
    ora_inizio: "21:00",
    durata_min: 600,
    scavalca_mezzanotte: true,
    is_notte: true,
    ordine_rotazione: 3,
    conta_nelle_ore: true,
    peso_ore: 1,
  },
]

export interface OpzioniScenario {
  mese?: string
  nPostazioni?: number
  nLavoratori?: number
  /** Persone richieste per turno, nell'ordine M / P / N. */
  copertura?: [number, number, number]
  assenze?: DatiIngresso["assenze"]
  vincoli?: Vincolo[]
  riposoDopoNotteH?: number
  giorniContesto?: number
  giorniContestoDopo?: number
}

export function scenario(o: OpzioniScenario = {}): DatiIngresso {
  const mese = o.mese ?? "2026-08-01"
  const nPost = o.nPostazioni ?? 1
  const nLav = o.nLavoratori ?? 7
  const cop = o.copertura ?? [2, 2, 1]

  const postazioni = Array.from({ length: nPost }, (_, i) => ({
    id: `p-${i}`,
    nome: `Postazione ${i + 1}`,
  }))

  const lavoratori = Array.from({ length: nLav }, (_, i) => ({
    id: `l-${i}`,
    nome: `Lav${i + 1}`,
    cognome: "Prova",
    ore_settimanali: 38,
    riposo_min_dopo_notte_h: o.riposoDopoNotteH ?? 48,
    max_giorni_consecutivi: 6,
  }))

  // Tutti abilitati ovunque.
  const abilitazioni = lavoratori.flatMap((l) =>
    postazioni.map((p) => ({ worker_id: l.id, position_id: p.id })),
  )

  const copertura = postazioni.flatMap((p) =>
    TURNI_STANDARD.flatMap((t, ti) =>
      Array.from({ length: 7 }, (_, g) => ({
        position_id: p.id,
        shift_type_id: t.id,
        giorno_settimana: g,
        tipo_giorno: "feriale" as const,
        n_richiesti: cop[ti],
      })),
    ),
  )

  return {
    mese,
    turni: TURNI_STANDARD,
    postazioni,
    lavoratori,
    abilitazioni,
    copertura,
    festivita: [],
    assenze: o.assenze ?? [],
    vincoli: o.vincoli ?? [],
    assegnazioniEsistenti: [],
    pesi: PESI_DEFAULT,
    regole: REGOLE_DEFAULT,
    giorniContesto: o.giorniContesto ?? 7,
    giorniContestoDopo: o.giorniContestoDopo ?? 0,
  }
}
