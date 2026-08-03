/**
 * Scenario con turni articolati: molte sigle, durate irregolari, responsabilità
 * distinte e abilitazioni ristrette.
 *
 * Lo scenario di riferimento in `scenari.ts` descrive il caso canonico — tre
 * turni da 7/7/10, rapporto 2:2:1, tutti abilitati ovunque. Esiste anche il
 * caso opposto, ed è quello che si incontra nei servizi socio-sanitari: una
 * ventina di sigle che combinano orario e mansione, durate da 4,5 a 11,5 ore,
 * e una sola persona di responsabilità per fascia.
 *
 * Serve a rispondere a una domanda che il caso canonico non pone: il solver
 * regge quando la difficoltà non viene dal numero di persone ma dalla forma
 * del problema — molti tipi di turno per molte postazioni?
 *
 * Ogni numero qui è un parametro. Nessuna configurazione di un cliente
 * specifico vive nel prodotto: questa è un'impalcatura di prova.
 */

import { PESI_DEFAULT, REGOLE_DEFAULT, type DatiIngresso, type RigaTurno } from "./modello"
import type { Vincolo } from "./tipi"

type Fascia = "mattino" | "pomeriggio" | "notte"

interface DefinizioneTurno {
  codice: string
  ora_inizio: string
  durata_min: number
  fascia: Fascia
}

/**
 * Le durate sono volutamente irregolari e alcune sigle condividono l'orario
 * differendo solo per la mansione: è il tratto che distingue questi servizi
 * dal ciclo canonico, dove un turno è definito dal solo orario.
 */
export const TURNI_ARTICOLATI: DefinizioneTurno[] = [
  { codice: "Ma", ora_inizio: "07:00", durata_min: 450, fascia: "mattino" },
  { codice: "Mb", ora_inizio: "07:00", durata_min: 420, fascia: "mattino" },
  { codice: "Mc", ora_inizio: "07:00", durata_min: 450, fascia: "mattino" },
  { codice: "Md", ora_inizio: "07:30", durata_min: 420, fascia: "mattino" },
  { codice: "Me", ora_inizio: "08:00", durata_min: 390, fascia: "mattino" },
  { codice: "Mf", ora_inizio: "08:00", durata_min: 330, fascia: "mattino" },
  { codice: "Pa", ora_inizio: "14:00", durata_min: 420, fascia: "pomeriggio" },
  { codice: "Pb", ora_inizio: "13:30", durata_min: 450, fascia: "pomeriggio" },
  { codice: "Pc", ora_inizio: "14:00", durata_min: 420, fascia: "pomeriggio" },
  { codice: "Pd", ora_inizio: "13:30", durata_min: 420, fascia: "pomeriggio" },
  { codice: "Pe", ora_inizio: "14:30", durata_min: 390, fascia: "pomeriggio" },
  { codice: "Pf", ora_inizio: "15:00", durata_min: 300, fascia: "pomeriggio" },
  { codice: "N1", ora_inizio: "20:00", durata_min: 660, fascia: "notte" },
  { codice: "N2", ora_inizio: "20:30", durata_min: 690, fascia: "notte" },
  { codice: "N", ora_inizio: "20:30", durata_min: 660, fascia: "notte" },
  // Unità semi-autonoma: turni propri, stesso organico.
  { codice: "MAP", ora_inizio: "08:30", durata_min: 270, fascia: "mattino" },
  { codice: "AP", ora_inizio: "15:00", durata_min: 360, fascia: "pomeriggio" },
  { codice: "PRG", ora_inizio: "08:00", durata_min: 360, fascia: "mattino" },
]

const ORDINE: Record<Fascia, number> = { mattino: 1, pomeriggio: 2, notte: 3 }

/**
 * Postazione = posto da coprire, cioè qualifica combinata con la mansione.
 *
 * Due assi in uno, perché il modello ne offre uno solo: la qualifica (chi sei)
 * e la responsabilità (cosa presidi in quel turno). `bacino` dice da quale
 * gruppo professionale si pesca; `ristretta` se dentro quel gruppo serve
 * un'abilitazione ulteriore.
 */
export type Bacino = "oss" | "educatore" | "misto"

export const POSTAZIONI_ARTICOLATE: {
  id: string
  nome: string
  bacino: Bacino
  ristretta: boolean
}[] = [
  { id: "resp-turno", nome: "Responsabile turno", bacino: "oss", ristretta: true },
  { id: "resp-sanitario", nome: "Responsabile sanitario", bacino: "oss", ristretta: true },
  { id: "uscita-1", nome: "1° operatore uscita", bacino: "oss", ristretta: false },
  { id: "uscita-2", nome: "2° operatore uscita", bacino: "oss", ristretta: false },
  { id: "uscita-3", nome: "3° operatore uscita", bacino: "oss", ristretta: false },
  { id: "assistenza", nome: "Assistenza", bacino: "oss", ristretta: false },
  // I turni di progetto sono aperti a entrambe le qualifiche: la legenda dice
  // "turno educatore o OSS". È l'unico punto in cui i bacini si toccano.
  { id: "progetto", nome: "Progetto educativo", bacino: "misto", ristretta: false },
  { id: "unita-2", nome: "Unità semi-autonoma", bacino: "educatore", ristretta: false },
]

/** Quale mansione va coperta, su quale sigla, da quante persone. */
const FABBISOGNO: { position_id: string; codice: string; n: number }[] = [
  // Esattamente un responsabile per fascia, ogni giorno.
  { position_id: "resp-turno", codice: "Ma", n: 1 },
  { position_id: "resp-turno", codice: "Pa", n: 1 },
  { position_id: "resp-turno", codice: "N2", n: 1 },

  { position_id: "resp-sanitario", codice: "Mc", n: 1 },
  { position_id: "resp-sanitario", codice: "Pc", n: 1 },

  { position_id: "uscita-1", codice: "Md", n: 1 },
  { position_id: "uscita-1", codice: "Pd", n: 1 },
  { position_id: "uscita-2", codice: "Me", n: 1 },
  { position_id: "uscita-2", codice: "Pe", n: 1 },
  { position_id: "uscita-3", codice: "Mf", n: 1 },
  { position_id: "uscita-3", codice: "Pf", n: 1 },

  { position_id: "assistenza", codice: "Mb", n: 1 },
  { position_id: "assistenza", codice: "Pb", n: 1 },
  { position_id: "assistenza", codice: "N1", n: 1 },
  { position_id: "assistenza", codice: "N", n: 1 },

  { position_id: "unita-2", codice: "MAP", n: 1 },
  { position_id: "unita-2", codice: "AP", n: 1 },

  { position_id: "progetto", codice: "PRG", n: 1 },
]

export interface OpzioniArticolato {
  mese?: string
  /** Operatori socio-sanitari: coprono l'assistenza e le responsabilità. */
  nOss?: number
  /** Educatori: bacino distinto, si sovrappone solo sui turni di progetto. */
  nEducatori?: number
  /** Quanti fra gli OSS sono abilitati alle mansioni di responsabilità. */
  nAbilitatiResponsabilita?: number
  oreSettimanali?: number
  riposoDopoNotteH?: number
  fabbisogno?: typeof FABBISOGNO
  assenze?: DatiIngresso["assenze"]
  vincoli?: Vincolo[]
}

export function scenarioArticolato(o: OpzioniArticolato = {}): DatiIngresso {
  const mese = o.mese ?? "2026-08-01"
  const nOss = o.nOss ?? 19
  const nEdu = o.nEducatori ?? 8
  const nResp = o.nAbilitatiResponsabilita ?? 8
  const fabbisogno = o.fabbisogno ?? FABBISOGNO

  const turni: RigaTurno[] = TURNI_ARTICOLATI.map((t) => ({
    id: `t-${t.codice}`,
    codice: t.codice,
    nome: t.codice,
    ora_inizio: t.ora_inizio,
    durata_min: t.durata_min,
    scavalca_mezzanotte: t.fascia === "notte",
    is_notte: t.fascia === "notte",
    ordine_rotazione: ORDINE[t.fascia],
    conta_nelle_ore: true,
    peso_ore: 1,
  }))

  const postazioni = POSTAZIONI_ARTICOLATE.map((p) => ({ id: p.id, nome: p.nome }))

  const qualifica = (i: number): Bacino => (i < nOss ? "oss" : "educatore")
  const lavoratori = Array.from({ length: nOss + nEdu }, (_, i) => ({
    id: `l-${i}`,
    nome: `${qualifica(i) === "oss" ? "OSS" : "Edu"}${i + 1}`,
    cognome: "Prova",
    ore_settimanali: o.oreSettimanali ?? 38,
    riposo_min_dopo_notte_h: o.riposoDopoNotteH ?? 48,
    max_giorni_consecutivi: 6,
  }))

  // Le mansioni di responsabilità le copre solo una parte dell'organico: è la
  // differenza che rende il problema realistico, perché restringe lo spazio
  // proprio sui turni che non possono restare scoperti.
  const abilitazioni = lavoratori.flatMap((l, i) =>
    POSTAZIONI_ARTICOLATE.filter((p) => {
      if (p.bacino !== "misto" && p.bacino !== qualifica(i)) return false
      return !p.ristretta || i < nResp
    }).map((p) => ({ worker_id: l.id, position_id: p.id })),
  )

  const copertura = fabbisogno.flatMap((f) =>
    Array.from({ length: 7 }, (_, g) => ({
      position_id: f.position_id,
      shift_type_id: `t-${f.codice}`,
      giorno_settimana: g,
      tipo_giorno: "feriale" as const,
      n_richiesti: f.n,
    })),
  )

  return {
    mese,
    turni,
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
    giorniContesto: 7,
    giorniContestoDopo: 0,
  }
}
