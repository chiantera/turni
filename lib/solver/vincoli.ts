/**
 * Vincoli e funzione di costo.
 *
 * Principio architetturale: i vincoli RIGIDI sono mantenuti come INVARIANTI,
 * non come penalità. `puoAssegnare` è il guardiano — nessuna mossa che lo violi
 * viene mai applicata. Di conseguenza un piano generato non può contenere
 * riposi insufficienti o assenze ignorate: quei casi sono impossibili per
 * costruzione, non "molto penalizzati e speriamo bene".
 *
 * L'unico modo in cui un piano può risultare insoddisfacente sul lato rigido è
 * uno SLOT SCOPERTO, che è un problema di organico e viene riportato come tale.
 *
 * I vincoli MORBIDI entrano invece nella funzione di costo, pesati.
 */

import { formattaOre } from "./tempo"
import { nomeCompleto } from "./tipi"
import type { Modello, Stato, Violazione } from "./tipi"

export const MIN_IN_H = 60
const MS_IN_H = 3_600_000

// ---------------------------------------------------------------------------
// Vincoli compilati
// ---------------------------------------------------------------------------

/**
 * I vincoli del DSL vengono "compilati" in tabelle piatte una volta sola.
 * Il ciclo di ricerca locale li consulta milioni di volte: risolvere UUID e
 * intervalli di date a ogni consultazione sarebbe il collo di bottiglia.
 */
export interface VincoliCompilati {
  /** vietato[lav*nGiorni*nTurni + g*nTurni + t] = 1 -> assegnazione proibita */
  vietato: Uint8Array
  /** bonus negativo (= premio) per le preferenze soddisfatte */
  preferenza: Float32Array
  /** postVietata[lav*nPost + p] = 1 */
  postVietata: Uint8Array
  /**
   * Tetti sul numero di turni di un tipo.
   *
   * `giorniMask` delimita i giorni in cui il tetto vale: senza di essa una
   * limitazione dichiarata per una settimana verrebbe applicata all'intero
   * periodo, trasformando una restrizione temporanea in permanente.
   */
  maxTurni: VoceConteggioTurni[]
  minTurni: VoceConteggioTurni[]
  /** Coppie che non devono coincidere nello stesso turno/giorno. */
  separati: { a: number; b: number; hard: boolean; peso: number; desc: string }[]
  /** Coppie che devono stare insieme. */
  insieme: { a: number; b: number; hard: boolean; peso: number; desc: string }[]
  /** Override del monte ore settimanale per singolo lavoratore. */
  oreOverride: Map<number, number>
  /** ID dei vincoli che il solver applica davvero. */
  applicati: Set<string>
  /**
   * Vincoli accettati dall'interfaccia ma NON applicati dal solver, con il
   * motivo. Devono diventare violazioni visibili: un vincolo silenziosamente
   * ignorato fa credere al pianificatore che la regola sia attiva mentre il
   * piano la viola, ed è la forma di errore più difficile da scoprire.
   */
  nonApplicati: { id: string; kind: string; descrizione: string; motivo: string }[]
  /**
   * Vincoli validi ma che non riguardano l'intervallo pianificato — per
   * esempio una regola di agosto mentre si pianifica luglio.
   *
   * Sono tenuti separati da `nonApplicati` di proposito: non c'è niente da
   * risolvere. Confonderli con un problema riempirebbe il pannello di allarmi
   * falsi, e un pannello pieno di allarmi falsi è un pannello che si smette
   * di leggere.
   */
  fuoriPeriodo: { id: string; kind: string; descrizione: string }[]
}

/**
 * Kind del DSL che il solver non sa ancora tradurre in comportamento.
 *
 * Sono dichiarati qui invece di essere semplicemente omessi dallo switch:
 * l'omissione è indistinguibile da una dimenticanza, mentre questo elenco
 * costringe a una scelta consapevole e viene riportato all'utente.
 *
 * - `insieme`: "devono stare nello stesso turno" è un vincolo globale. Un
 *   guardiano locale non può imporlo, perché quando si assegna il primo dei
 *   due non si sa ancora se il secondo troverà posto.
 * - `copertura_override` e `assegnazione_fissa`: modificano la forma del
 *   modello (quanti slot esistono, chi è già fissato) e vanno applicati in
 *   costruzione, non durante la ricerca.
 */
export const KIND_NON_SUPPORTATI: Record<string, string> = {
  insieme:
    "richiede una verifica globale: un controllo locale non può garantire che due persone finiscano nello stesso turno",
  copertura_override:
    "modifica il numero di slot e va applicato alla costruzione del modello",
  assegnazione_fissa:
    "fissa una persona su uno slot e va applicato alla costruzione del modello",
}

export interface VoceConteggioTurni {
  id: string
  lav: number
  turno: number
  n: number
  hard: boolean
  peso: number
  desc: string
  /** giorniMask[giornoIdx] = 1 se il vincolo vale quel giorno. */
  giorniMask: Uint8Array
}

export interface MotivoAssegnabilita {
  codice: string
  messaggio: string
  rilassabile: boolean
  vincoloId?: string
  valore?: number
  soglia?: number
}

export interface ValutazioneAssegnabilita {
  consentita: boolean
  motivi: MotivoAssegnabilita[]
}

interface ParamsVincolo {
  lavoratore?: string
  lavoratori?: string[]
  giorni?: number[]
  date?: string[]
  turni?: string[]
  postazioni?: string[]
  n?: number
  ore_settimana?: number
}

export function compilaVincoli(m: Modello): VincoliCompilati {
  const nL = m.lavoratori.length
  const nG = m.nGiorni
  const nT = m.turni.length
  const nP = m.postazioni.length

  const c: VincoliCompilati = {
    vietato: new Uint8Array(nL * nG * nT),
    preferenza: new Float32Array(nL * nG * nT),
    postVietata: new Uint8Array(nL * nP),
    maxTurni: [],
    minTurni: [],
    separati: [],
    insieme: [],
    oreOverride: new Map(),
    applicati: new Set(),
    nonApplicati: [],
    fuoriPeriodo: [],
  }

  const idxLav = new Map(m.lavoratori.map((l, i) => [l.id, i]))
  const idxTurno = new Map(m.turni.map((t, i) => [t.id, i]))
  const idxTurnoCod = new Map(m.turni.map((t, i) => [t.codice, i]))
  const idxPost = new Map(m.postazioni.map((p, i) => [p.id, i]))

  const risolviTurni = (v?: string[]): number[] => {
    if (!v || v.length === 0) return m.turni.map((_, i) => i)
    const out: number[] = []
    for (const x of v) {
      const i = idxTurno.get(x) ?? idxTurnoCod.get(x)
      if (i !== undefined) out.push(i)
    }
    return out
  }

  for (const v of m.vincoli) {
    const p = v.params as ParamsVincolo
    const lav = p.lavoratore ? idxLav.get(p.lavoratore) : undefined

    const applica = () => c.applicati.add(v.id)
    /** Valido, ma non riguarda questo intervallo: nulla da segnalare. */
    const fuori = () =>
      c.fuoriPeriodo.push({ id: v.id, kind: v.kind, descrizione: v.descrizione })
    const scarta = (motivo: string) =>
      c.nonApplicati.push({
        id: v.id,
        kind: v.kind,
        descrizione: v.descrizione,
        motivo,
      })

    // Giorni dell'orizzonte toccati dal vincolo
    const giorniValidi: number[] = []
    for (let g = 0; g < nG; g++) {
      const dt = m.date[g]
      if (v.validoDal && dt < v.validoDal) continue
      if (v.validoAl && dt > v.validoAl) continue
      if (p.date && p.date.length > 0 && !p.date.includes(dt)) continue
      if (p.giorni && p.giorni.length > 0) {
        const dow = new Date(dt + "T00:00:00Z").getUTCDay()
        if (!p.giorni.includes(dow)) continue
      }
      giorniValidi.push(g)
    }

    switch (v.kind) {
      case "indisponibile":
      case "turno_vietato": {
        if (lav === undefined) {
          scarta("il lavoratore indicato non esiste o non è più attivo")
          break
        }
        const turni = risolviTurni(p.turni)
        if (turni.length === 0) {
          scarta("nessuno dei turni indicati esiste")
          break
        }
        if (giorniValidi.length === 0) {
          fuori()
          break
        }
        for (const g of giorniValidi) {
          for (const t of turni) {
            const i = lav * nG * nT + g * nT + t
            if (v.isHard) c.vietato[i] = 1
            else c.preferenza[i] += v.peso * m.pesi.preferenze // costo positivo = da evitare
          }
        }
        applica()
        break
      }

      case "preferenza": {
        if (lav === undefined) {
          scarta("il lavoratore indicato non esiste o non è più attivo")
          break
        }
        const turni = risolviTurni(p.turni)
        if (turni.length === 0) {
          scarta("nessuno dei turni indicati esiste")
          break
        }
        if (giorniValidi.length === 0) {
          fuori()
          break
        }
        for (const g of giorniValidi) {
          for (const t of turni) {
            // Premio: costo negativo quando la preferenza è soddisfatta.
            c.preferenza[lav * nG * nT + g * nT + t] -=
              v.peso * m.pesi.preferenze
          }
        }
        applica()
        break
      }

      case "postazione_fissa": {
        if (lav === undefined) {
          scarta("il lavoratore indicato non esiste o non è più attivo")
          break
        }
        // La variante morbida richiederebbe un costo per postazione, che oggi
        // non esiste. Applicarla come divieto la trasformerebbe in un obbligo
        // assoluto: una semplice preferenza potrebbe lasciare turni scoperti.
        if (!v.isHard) {
          scarta(
            "la variante come preferenza non è ancora supportata: impostalo come obbligo assoluto oppure rimuovilo",
          )
          break
        }
        const consentite = new Set(
          (p.postazioni ?? [])
            .map((x) => idxPost.get(x))
            .filter((x): x is number => x !== undefined),
        )
        if (consentite.size === 0) {
          scarta("nessuna delle postazioni indicate esiste")
          break
        }
        for (let pi = 0; pi < nP; pi++) {
          if (!consentite.has(pi)) c.postVietata[lav * nP + pi] = 1
        }
        applica()
        break
      }

      case "max_turni":
      case "min_turni": {
        if (lav === undefined) {
          scarta("il lavoratore indicato non esiste o non è più attivo")
          break
        }
        if (p.n === undefined) {
          scarta("manca il numero di turni")
          break
        }
        const turni = risolviTurni(p.turni)
        if (turni.length === 0) {
          scarta("nessuno dei turni indicati esiste")
          break
        }
        if (giorniValidi.length === 0) {
          fuori()
          break
        }
        const giorniMask = new Uint8Array(nG)
        for (const g of giorniValidi) giorniMask[g] = 1
        for (const t of turni) {
          const voce: VoceConteggioTurni = {
            id: v.id,
            lav,
            turno: t,
            n: p.n,
            hard: v.isHard,
            peso: v.peso,
            desc: v.descrizione,
            giorniMask,
          }
          if (v.kind === "max_turni") c.maxTurni.push(voce)
          else c.minTurni.push(voce)
        }
        applica()
        break
      }

      case "separati": {
        const ids = (p.lavoratori ?? []).map((x) => idxLav.get(x))
        if (ids.length < 2 || ids[0] === undefined || ids[1] === undefined) {
          scarta("servono due lavoratori esistenti e attivi")
          break
        }
        // Come sopra: il costo per coppia non è ancora nella funzione
        // obiettivo, quindi la variante morbida non avrebbe alcun effetto.
        if (!v.isHard) {
          scarta(
            "la variante come preferenza non è ancora supportata: impostalo come obbligo assoluto oppure rimuovilo",
          )
          break
        }
        c.separati.push({
          a: ids[0],
          b: ids[1],
          hard: true,
          peso: v.peso,
          desc: v.descrizione,
        })
        applica()
        break
      }

      case "ore_override": {
        if (lav === undefined) {
          scarta("il lavoratore indicato non esiste o non è più attivo")
          break
        }
        if (p.ore_settimana === undefined) {
          scarta("mancano le ore settimanali")
          break
        }
        c.oreOverride.set(lav, p.ore_settimana)
        applica()
        break
      }

      case "insieme":
      case "copertura_override":
      case "assegnazione_fissa":
        scarta(KIND_NON_SUPPORTATI[v.kind])
        break

      default:
        // Se un nuovo kind viene aggiunto a KindVincolo senza un ramo qui,
        // il compilatore si ferma su questa riga. È l'unico modo perché
        // "aggiungere un tipo di vincolo" non significhi "aggiungere un
        // vincolo che nessuno applica".
        vincoloNonGestito(v.kind)
    }
  }

  return c
}

function vincoloNonGestito(kind: never): never {
  throw new Error(`Tipo di vincolo non gestito dal solver: ${String(kind)}`)
}

// ---------------------------------------------------------------------------
// Stato
// ---------------------------------------------------------------------------

export function creaStato(m: Modello): Stato {
  const nL = m.lavoratori.length
  const s: Stato = {
    assegnatoA: new Int32Array(m.slots.length).fill(-1),
    turnoDelGiorno: new Int32Array(nL * m.nGiorni).fill(-1),
    postazioneDelGiorno: new Int32Array(nL * m.nGiorni).fill(-1),
    bloccato: new Uint8Array(m.slots.length),
  }

  // Le assegnazioni fisse occupano il giorno del lavoratore. Quelle che
  // ricadono nel periodo pianificato (blocchi manuali) consumano anche lo slot.
  for (const f of m.fisse) {
    const g = m.date.indexOf(f.data)
    if (g < 0) continue
    s.turnoDelGiorno[f.lavoratoreIdx * m.nGiorni + g] = f.turnoIdx
    s.postazioneDelGiorno[f.lavoratoreIdx * m.nGiorni + g] = f.postazioneIdx
    if (f.nelPeriodo) {
      const slot = m.slots.find(
        (sl) =>
          sl.giornoIdx === g &&
          sl.turnoIdx === f.turnoIdx &&
          sl.postazioneIdx === f.postazioneIdx &&
          s.assegnatoA[sl.idx] === -1,
      )
      if (slot) {
        s.assegnatoA[slot.idx] = f.lavoratoreIdx
        s.bloccato[slot.idx] = 1
      }
    }
  }
  return s
}

export function assegna(m: Modello, s: Stato, slotIdx: number, lav: number): void {
  const sl = m.slots[slotIdx]
  s.assegnatoA[slotIdx] = lav
  s.turnoDelGiorno[lav * m.nGiorni + sl.giornoIdx] = sl.turnoIdx
  s.postazioneDelGiorno[lav * m.nGiorni + sl.giornoIdx] = sl.postazioneIdx
}

export function libera(m: Modello, s: Stato, slotIdx: number): number {
  const lav = s.assegnatoA[slotIdx]
  if (lav < 0) return -1
  const sl = m.slots[slotIdx]
  s.assegnatoA[slotIdx] = -1
  s.turnoDelGiorno[lav * m.nGiorni + sl.giornoIdx] = -1
  s.postazioneDelGiorno[lav * m.nGiorni + sl.giornoIdx] = -1
  return lav
}

// ---------------------------------------------------------------------------
// Vincoli rigidi — il guardiano
// ---------------------------------------------------------------------------

/**
 * Può il lavoratore `lav` coprire lo slot `slotIdx`?
 * Verifica TUTTI i vincoli rigidi. Se torna true, assegnare non introduce
 * violazioni rigide (a parte quelle già presenti nelle assegnazioni bloccate).
 */
export function puoAssegnare(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  slotIdx: number,
  lav: number,
): boolean {
  return controllaAssegnabilita(m, s, c, slotIdx, lav)
}

/**
 * Spiega perché una persona non può coprire uno slot.
 *
 * Usa gli stessi controlli del guardiano impiegato dal solver: la diagnostica
 * non deve ricostruire le regole da testo libero né divergere dall'enforcement.
 */
export function valutaAssegnabilita(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  slotIdx: number,
  lav: number,
): ValutazioneAssegnabilita {
  const motivi: MotivoAssegnabilita[] = []
  controllaAssegnabilita(m, s, c, slotIdx, lav, motivi)
  return { consentita: motivi.length === 0, motivi }
}

function rifiutaMotivo(): boolean {
  return true
}

function aggiungiMotivo(
  motivi: MotivoAssegnabilita[],
): (motivo: MotivoAssegnabilita) => boolean {
  return (motivo) => {
    motivi.push(motivo)
    return false
  }
}

function controllaAssegnabilita(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  slotIdx: number,
  lav: number,
  motivi?: MotivoAssegnabilita[],
): boolean {
  const sl = m.slots[slotIdx]
  const g = sl.giornoIdx
  const t = sl.turnoIdx
  const nG = m.nGiorni
  const nT = m.turni.length
  const base = lav * nG

  const blocca = motivi === undefined ? rifiutaMotivo : aggiungiMotivo(motivi)

  // 1. Un solo turno al giorno
  if (s.turnoDelGiorno[base + g] !== -1) {
    if (blocca({
      codice: "turno_gia_assegnato",
      messaggio: "Il lavoratore ha già un turno nello stesso giorno.",
      rilassabile: false,
    })) return false
  }

  // 2. Assenze
  if (m.assente[base + g]) {
    if (blocca({
      codice: "assenza",
      messaggio: `Il lavoratore è assente il ${sl.data}.`,
      rilassabile: false,
    })) return false
  }
  if (m.assenteSuTurno.has(`${lav}:${g}:${t}`)) {
    if (blocca({
      codice: "assenza_turno",
      messaggio: `Il lavoratore è assente per il turno del ${sl.data}.`,
      rilassabile: false,
    })) return false
  }

  // 3. Abilitazione alla postazione
  if (!m.abilitato[lav * m.postazioni.length + sl.postazioneIdx]) {
    if (blocca({
      codice: "abilitazione_mancante",
      messaggio: "Il lavoratore non è abilitato alla postazione.",
      rilassabile: false,
    })) return false
  }
  if (c.postVietata[lav * m.postazioni.length + sl.postazioneIdx]) {
    if (blocca({
      codice: "postazione_vietata",
      messaggio: "Un vincolo impedisce al lavoratore di usare la postazione.",
      rilassabile: true,
    })) return false
  }

  // 4. Vincoli rigidi dal DSL
  if (c.vietato[lav * nG * nT + g * nT + t]) {
    if (blocca({
      codice: "turno_vietato",
      messaggio: "Un vincolo impedisce al lavoratore di svolgere questo turno.",
      rilassabile: true,
    })) return false
  }

  // I controlli temporali presuppongono che il giorno sia ancora libero.
  if (s.turnoDelGiorno[base + g] === -1) {
    // 5. Riposo minimo rispetto al giorno precedente e al successivo
    if (!riposoOk(m, s, lav, g, t)) {
      if (blocca({
        codice: "riposo_insufficiente",
        messaggio: "Il riposo tra i turni sarebbe inferiore al minimo configurato.",
        rilassabile: false,
      })) return false
    }

    // 6. Giorni consecutivi
    if (!giorniConsecutiviOk(m, s, lav, g)) {
      if (blocca({
        codice: "giorni_consecutivi",
        messaggio: "Il turno supererebbe il massimo di giorni consecutivi.",
        rilassabile: true,
        valore: giorniConsecutivi(m, s, lav, g),
        soglia: m.lavoratori[lav].maxGiorniConsecutivi,
      })) return false
    }

    // 7. Tetti sul numero di turni (solo quelli rigidi)
    for (const mt of c.maxTurni) {
      if (mt.lav !== lav || mt.turno !== t || !mt.hard) continue
      if (!mt.giorniMask[g]) continue
      const valore = contaTurni(m, s, lav, t, mt.giorniMask)
      if (valore >= mt.n) {
        if (blocca({
          codice: "max_turni",
          messaggio: mt.desc,
          rilassabile: true,
          vincoloId: mt.id,
          valore,
          soglia: mt.n,
        })) return false
      }
    }

    // 8. Coppie da tenere separate
    for (const sep of c.separati) {
      if (!sep.hard) continue
      const altro = sep.a === lav ? sep.b : sep.b === lav ? sep.a : -1
      if (altro < 0) continue
      if (s.turnoDelGiorno[altro * nG + g] === t) {
        if (blocca({
          codice: "separati",
          messaggio: sep.desc,
          rilassabile: true,
        })) return false
      }
    }

    // 9. Tetto globale delle ore nella settimana di calendario.
    const turno = m.turni[t]
    if (turno.contaNelleOre) {
      const settimana = m.settimanaDi[g]
      const oreDopo =
        oreSettimana(m, s, lav, settimana) +
        (turno.durataMin * turno.pesoOre) / MIN_IN_H
      if (oreDopo > m.regole.maxOreSettimana + 1e-9) {
        if (blocca({
          codice: "max_ore_settimana",
          messaggio: "Il turno supererebbe il tetto globale di ore settimanali.",
          rilassabile: true,
          valore: oreDopo,
          soglia: m.regole.maxOreSettimana,
        })) return false
      }
    }
  }

  return motivi === undefined || motivi.length === 0
}

/**
 * Riposo fra turni. Usa gli istanti REALI (non l'orario da calendario), così
 * la notte del cambio ora legale viene valutata correttamente.
 *
 * Due soglie:
 *   - riposoMinOre (11h di legge) fra due turni qualsiasi
 *   - riposoDopoNotteOre (24-48h) dopo un turno di notte
 */
function riposoOk(m: Modello, s: Stato, lav: number, g: number, t: number): boolean {
  const nT = m.turni.length
  const nG = m.nGiorni
  const minMs = m.regole.riposoMinOre * MS_IN_H
  const inizioNuovo = m.inizioUtc[g * nT + t]
  const fineNuovo = m.fineUtc[g * nT + t]
  const nuovoENotte = m.turni[t].isNotte

  // Guardo abbastanza indietro/avanti da coprire il riposo post-notte più lungo.
  const raggio = Math.max(2, Math.ceil(m.regole.riposoDopoNotteOre / 24) + 1)

  for (let d = -raggio; d <= raggio; d++) {
    if (d === 0) continue
    const gg = g + d
    if (gg < 0 || gg >= nG) continue
    const tt = s.turnoDelGiorno[lav * nG + gg]
    if (tt === -1) continue

    const inizioAltro = m.inizioUtc[gg * nT + tt]
    const fineAltro = m.fineUtc[gg * nT + tt]
    const altroENotte = m.turni[tt].isNotte

    if (d < 0) {
      // L'altro turno precede: dev'esserci abbastanza stacco prima del nuovo.
      const stacco = inizioNuovo - fineAltro
      if (stacco < 0) return false // sovrapposizione
      const richiesto = altroENotte
        ? m.lavoratori[lav].riposoDopoNotteH * MS_IN_H
        : minMs
      if (stacco < richiesto) return false
    } else {
      // Il nuovo turno precede l'altro.
      const stacco = inizioAltro - fineNuovo
      if (stacco < 0) return false
      const richiesto = nuovoENotte
        ? m.lavoratori[lav].riposoDopoNotteH * MS_IN_H
        : minMs
      if (stacco < richiesto) return false
    }
  }
  return true
}

/** Lavorare il giorno `g` non deve creare una serie più lunga del consentito. */
function giorniConsecutivi(m: Modello, s: Stato, lav: number, g: number): number {
  const nG = m.nGiorni
  const base = lav * nG
  let serie = 1
  for (let i = g - 1; i >= 0 && s.turnoDelGiorno[base + i] !== -1; i--) serie++
  for (let i = g + 1; i < nG && s.turnoDelGiorno[base + i] !== -1; i++) serie++
  return serie
}

function giorniConsecutiviOk(m: Modello, s: Stato, lav: number, g: number): boolean {
  return giorniConsecutivi(m, s, lav, g) <= m.lavoratori[lav].maxGiorniConsecutivi
}

/**
 * Conta i turni di un tipo assegnati al lavoratore, limitatamente ai giorni
 * in cui il vincolo vale. Senza la maschera una limitazione dichiarata per
 * pochi giorni verrebbe misurata sull'intero periodo.
 */
function contaTurni(
  m: Modello,
  s: Stato,
  lav: number,
  turno: number,
  giorniMask?: Uint8Array,
): number {
  let n = 0
  const base = lav * m.nGiorni
  for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
    if (giorniMask && !giorniMask[g]) continue
    if (s.turnoDelGiorno[base + g] === turno) n++
  }
  return n
}

/** Ore già assegnate al lavoratore in una settimana di calendario. */
export function oreSettimana(
  m: Modello,
  s: Stato,
  lav: number,
  settimana: number,
): number {
  let minuti = 0
  const base = lav * m.nGiorni
  for (let g = 0; g < m.nGiorni; g++) {
    if (m.settimanaDi[g] !== settimana) continue
    const t = s.turnoDelGiorno[base + g]
    if (t < 0 || !m.turni[t].contaNelleOre) continue
    minuti += m.turni[t].durataMin * m.turni[t].pesoOre
  }
  return minuti / MIN_IN_H
}

/** Ore assegnate per tutte le settimane dell'orizzonte, incluso il contesto. */
export function orePerSettimana(
  m: Modello,
  s: Stato,
  lav: number,
): number[] {
  const minutiPerSettimana = new Array(m.nSettimane).fill(0) as number[]
  const base = lav * m.nGiorni
  for (let g = 0; g < m.nGiorni; g++) {
    const t = s.turnoDelGiorno[base + g]
    if (t < 0 || !m.turni[t].contaNelleOre) continue
    minutiPerSettimana[m.settimanaDi[g]] +=
      m.turni[t].durataMin * m.turni[t].pesoOre
  }
  return minutiPerSettimana.map((minuti) => minuti / MIN_IN_H)
}

// ---------------------------------------------------------------------------
// Costo
// ---------------------------------------------------------------------------

/** Penalità per uno slot scoperto. Domina tutto: coprire viene prima. */
export const COSTO_SCOPERTO = 100_000

export interface Costo {
  totale: number
  scoperti: number
  perLavoratore: Float64Array
  equita: number
}

/**
 * Costo di un singolo lavoratore: monte ore, aderenza al ciclo canonico,
 * rotazione, frammentazione, stabilità di postazione, preferenze.
 */
export function costoLavoratore(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
  lav: number,
): number {
  const nG = m.nGiorni
  const nT = m.turni.length
  const base = lav * nG
  const pesi = m.pesi
  const L = m.lavoratori[lav]
  const oreSett = c.oreOverride.get(lav) ?? L.oreSettimanali

  let costo = 0

  // --- Monte ore per settimana --------------------------------------------
  const minutiSett = new Float64Array(m.nSettimane)
  const giorniPeriodoSett = new Int32Array(m.nSettimane)
  let nottiTot = 0

  for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
    giorniPeriodoSett[m.settimanaDi[g]]++
    const t = s.turnoDelGiorno[base + g]
    if (t === -1) continue
    const tt = m.turni[t]
    if (tt.contaNelleOre) {
      minutiSett[m.settimanaDi[g]] += tt.durataMin * tt.pesoOre
    }
    if (tt.isNotte) nottiTot++
    // Preferenze / avversioni morbide
    costo += c.preferenza[lav * nG * nT + g * nT + t]
  }

  for (let w = 0; w < m.nSettimane; w++) {
    const gg = giorniPeriodoSett[w]
    if (gg === 0) continue
    // Settimane parziali ai bordi del mese: il target si riduce in proporzione.
    const target = oreSett * MIN_IN_H * (gg / 7)
    const scarto = Math.abs(minutiSett[w] - target) / MIN_IN_H
    costo += scarto * pesi.ore_target

    // Aderenza al ciclo canonico: con 38h la settimana tipo ha 1 notte.
    if (gg === 7) {
      const nottiTarget = oreSett / 38
      let nottiSett = 0
      for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
        if (m.settimanaDi[g] !== w) continue
        const t = s.turnoDelGiorno[base + g]
        if (t !== -1 && m.turni[t].isNotte) nottiSett++
      }
      costo += Math.abs(nottiSett - nottiTarget) * pesi.pattern_settimanale
    }
  }

  // --- Struttura della sequenza -------------------------------------------
  // Un solo passaggio sull'orizzonte (contesto incluso: la rotazione deve
  // essere continua a cavallo del cambio mese).
  let lungBlocco = 0
  let turnoBlocco = -1

  for (let g = 1; g < nG; g++) {
    const prec = s.turnoDelGiorno[base + g - 1]
    const cur = s.turnoDelGiorno[base + g]

    // Rotazione in avanti fra due giorni lavorati consecutivi
    if (prec !== -1 && cur !== -1) {
      const op = m.turni[prec].ordineRotazione
      const oc = m.turni[cur].ordineRotazione
      if (op !== null && oc !== null && oc < op) {
        costo += (op - oc) * pesi.rotazione_avanti
      }
      // Stabilità di postazione dentro la serie
      if (
        s.postazioneDelGiorno[base + g] !== s.postazioneDelGiorno[base + g - 1]
      ) {
        costo += pesi.stabilita_postazione
      }
    }

    // Blocchi dello stesso turno: il ciclo canonico ne vuole al massimo 2
    if (cur !== -1 && cur === turnoBlocco) lungBlocco++
    else {
      if (lungBlocco > 2) costo += (lungBlocco - 2) * pesi.pattern_settimanale
      lungBlocco = cur === -1 ? 0 : 1
      turnoBlocco = cur
    }

    // Giorno lavorato isolato / riposo isolato
    if (g >= 1 && g < nG - 1) {
      const succ = s.turnoDelGiorno[base + g + 1]
      if (cur !== -1 && prec === -1 && succ === -1) costo += pesi.giorno_isolato
      if (cur === -1 && prec !== -1 && succ !== -1) costo += pesi.riposo_isolato
    }
  }
  if (lungBlocco > 2) costo += (lungBlocco - 2) * pesi.pattern_settimanale

  // --- Tetti morbidi sul numero di turni ----------------------------------
  for (const mt of c.maxTurni) {
    if (mt.lav !== lav || mt.hard) continue
    const n = contaTurni(m, s, lav, mt.turno, mt.giorniMask)
    if (n > mt.n) costo += (n - mt.n) * mt.peso
  }
  for (const mn of c.minTurni) {
    if (mn.lav !== lav) continue
    const n = contaTurni(m, s, lav, mn.turno, mn.giorniMask)
    if (n < mn.n) costo += (mn.n - n) * mn.peso * (mn.hard ? 10 : 1)
  }

  void nottiTot
  return costo
}

/**
 * Minuti contrattuali attesi da un lavoratore sul periodo pianificato.
 *
 * Stessa formula di `riepiloghi()` e della colonna «Ore» della griglia: il
 * monte ore settimanale riproporzionato ai giorni effettivi. Sta qui, e non
 * copiata in tre punti, perché costo individuale, equità e fase greedy devono
 * misurare lo stesso target — override da vincolo DSL compresi.
 */
export function targetMinutiPeriodo(m: Modello, c: VincoliCompilati, lav: number): number {
  const oreSett = c.oreOverride.get(lav) ?? m.lavoratori[lav].oreSettimanali
  return (oreSett * MIN_IN_H * (m.fineOffsetPeriodo - m.offsetPeriodo)) / 7
}

/** Minuti già assegnati a un lavoratore dentro il periodo pianificato. */
export function minutiAssegnatiPeriodo(m: Modello, s: Stato, lav: number): number {
  let minuti = 0
  for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
    const t = s.turnoDelGiorno[lav * m.nGiorni + g]
    if (t === -1) continue
    const tt = m.turni[t]
    if (tt.contaNelleOre) minuti += tt.durataMin * tt.pesoOre
  }
  return minuti
}

/** Equità: quanto è sbilanciata la distribuzione fra i lavoratori. */
export function costoEquita(m: Modello, s: Stato, c: VincoliCompilati): number {
  const nL = m.lavoratori.length
  const nG = m.nGiorni
  const notti = new Float64Array(nL)
  const festivi = new Float64Array(nL)
  const scartoOre = new Float64Array(nL)

  for (let l = 0; l < nL; l++) {
    let minuti = 0
    for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
      const t = s.turnoDelGiorno[l * nG + g]
      if (t === -1) continue
      const tt = m.turni[t]
      if (tt.isNotte) notti[l]++
      if (m.giornoFestivo[g]) festivi[l]++
      if (tt.contaNelleOre) minuti += tt.durataMin * tt.pesoOre
    }
    // Scarto dal PROPRIO contratto, non ore assolute.
    //
    // Misurare la dispersione delle ore assolute è sbagliato appena due
    // contratti differiscono: un part-time perfettamente in pari col proprio
    // monte ore risultava «sbilanciato», e il solver era incentivato a
    // caricarlo per ridurre la deviazione. Un contratto più piccolo è una
    // buona ragione per lavorare meno; essere indietro sul proprio non lo è.
    scartoOre[l] = (minuti - targetMinutiPeriodo(m, c, l)) / MIN_IN_H
  }

  // Deviazione standard: penalizza chi si accolla più notti degli altri.
  // Nota: notti e festivi restano in valore assoluto. Lo stesso ragionamento
  // sui contratti varrebbe anche per loro, ma è un cambiamento separato.
  return (
    deviazione(notti) * m.pesi.equita_notti +
    deviazione(festivi) * m.pesi.equita_weekend +
    deviazione(scartoOre) * m.pesi.equita_ore
  )
}

function deviazione(v: Float64Array): number {
  const n = v.length
  if (n === 0) return 0
  let somma = 0
  for (let i = 0; i < n; i++) somma += v[i]
  const media = somma / n
  let sq = 0
  for (let i = 0; i < n; i++) sq += (v[i] - media) ** 2
  return Math.sqrt(sq / n)
}

export function costoTotale(m: Modello, s: Stato, c: VincoliCompilati): Costo {
  let scoperti = 0
  for (let i = 0; i < s.assegnatoA.length; i++) {
    if (s.assegnatoA[i] === -1) scoperti++
  }

  const perLav = new Float64Array(m.lavoratori.length)
  let sommaLav = 0
  for (let l = 0; l < m.lavoratori.length; l++) {
    perLav[l] = costoLavoratore(m, s, c, l)
    sommaLav += perLav[l]
  }

  const eq = costoEquita(m, s, c)
  return {
    totale: scoperti * COSTO_SCOPERTO + sommaLav + eq,
    scoperti,
    perLavoratore: perLav,
    equita: eq,
  }
}

// ---------------------------------------------------------------------------
// Diagnostica per l'utente
// ---------------------------------------------------------------------------

export function trovaViolazioni(
  m: Modello,
  s: Stato,
  c: VincoliCompilati,
): Violazione[] {
  const out: Violazione[] = []
  const nG = m.nGiorni
  const nT = m.turni.length

  // --- Vincoli accettati ma non applicati ----------------------------------
  // Vanno in cima e sono bloccanti: finché uno di questi resta, il piano non
  // rispetta una regola che il pianificatore crede attiva.
  for (const v of c.nonApplicati) {
    out.push({
      tipo: "vincolo_non_supportato",
      gravita: "bloccante",
      messaggio: `Il vincolo «${v.descrizione}» non è stato applicato: ${v.motivo}.`,
      riferimenti: { vincoloId: v.id, kind: v.kind, motivo: v.motivo },
    })
  }

  // --- Slot scoperti (raggruppati per giorno/turno/postazione) -------------
  const scoperti = new Map<
    string,
    { data: string; postazioneIdx: number; turnoIdx: number; n: number }
  >()
  for (const sl of m.slots) {
    if (s.assegnatoA[sl.idx] !== -1) continue
    const k = `${sl.data}:${sl.postazioneIdx}:${sl.turnoIdx}`
    const v = scoperti.get(k)
    if (v) v.n++
    else
      scoperti.set(k, {
        data: sl.data,
        postazioneIdx: sl.postazioneIdx,
        turnoIdx: sl.turnoIdx,
        n: 1,
      })
  }
  for (const v of scoperti.values()) {
    const slot = m.slots.find(
      (sl) =>
        sl.data === v.data &&
        sl.postazioneIdx === v.postazioneIdx &&
        sl.turnoIdx === v.turnoIdx &&
        s.assegnatoA[sl.idx] === -1,
    )
    const postazione = m.postazioni[v.postazioneIdx]
    const turno = m.turni[v.turnoIdx]
    const blocker = new Map<
      string,
      { codice: string; conteggio: number; vincoloIds: string[] }
    >()
    if (slot) {
      for (let lav = 0; lav < m.lavoratori.length; lav++) {
        const valutazione = valutaAssegnabilita(m, s, c, slot.idx, lav)
        for (const motivo of valutazione.motivi) {
          const precedente = blocker.get(motivo.codice)
          if (precedente) {
            precedente.conteggio++
            if (motivo.vincoloId && !precedente.vincoloIds.includes(motivo.vincoloId)) {
              precedente.vincoloIds.push(motivo.vincoloId)
            }
          } else {
            blocker.set(motivo.codice, {
              codice: motivo.codice,
              conteggio: 1,
              vincoloIds: motivo.vincoloId ? [motivo.vincoloId] : [],
            })
          }
        }
      }
    }
    out.push({
      tipo: "copertura",
      gravita: "bloccante",
      data: v.data,
      messaggio: `${v.data}: mancano ${v.n} persone su "${postazione.nome}" nel turno ${turno.nome}.`,
      riferimenti: {
        slotKey: `${v.data}:${postazione.id}:${turno.id}`,
        postazioneId: postazione.id,
        turnoId: turno.id,
        postazioneIdx: v.postazioneIdx,
        turnoIdx: v.turnoIdx,
        postazione: postazione.nome,
        turno: turno.nome,
        mancanti: v.n,
        blocker: [...blocker.values()],
      },
    })
  }

  // --- Riposi e serie (le assegnazioni bloccate a mano possono violare) ----
  for (let l = 0; l < m.lavoratori.length; l++) {
    const L = m.lavoratori[l]
    const nome = nomeCompleto(L)
    const base = l * nG

    let serie = 0
    for (let g = 0; g < nG; g++) {
      const nelPeriodo = g >= m.offsetPeriodo && g < m.fineOffsetPeriodo
      const t = s.turnoDelGiorno[base + g]
      if (t === -1) {
        serie = 0
        continue
      }
      serie++
      if (serie > L.maxGiorniConsecutivi && nelPeriodo) {
        out.push({
          tipo: "giorni_consecutivi",
          gravita: "bloccante",
          data: m.date[g],
          lavoratoreIdx: l,
          messaggio: `${nome}: ${serie} giorni consecutivi di lavoro al ${m.date[g]} (massimo ${L.maxGiorniConsecutivi}).`,
        })
      }

      // Riposo rispetto al giorno lavorato precedente
      for (let d = 1; d <= 3 && g - d >= 0; d++) {
        const tp = s.turnoDelGiorno[base + g - d]
        if (tp === -1) continue
        const stacco =
          (m.inizioUtc[g * nT + t] - m.fineUtc[(g - d) * nT + tp]) / MS_IN_H
        const richiesto = m.turni[tp].isNotte ? L.riposoDopoNotteH : m.regole.riposoMinOre
        if (stacco < richiesto && nelPeriodo) {
          out.push({
            tipo: m.turni[tp].isNotte ? "riposo_dopo_notte" : "riposo_minimo",
            gravita: "bloccante",
            data: m.date[g],
            lavoratoreIdx: l,
            messaggio: m.turni[tp].isNotte
              ? `${nome}: solo ${stacco.toFixed(1)}h di riposo dopo la notte del ${m.date[g - d]} (minimo ${richiesto}h).`
              : `${nome}: solo ${stacco.toFixed(1)}h fra il turno del ${m.date[g - d]} e quello del ${m.date[g]} (minimo ${richiesto}h).`,
          })
        }
        break // basta il turno lavorato più recente
      }

      // Assenza ignorata da un blocco manuale
      if (m.assente[base + g] && nelPeriodo) {
        out.push({
          tipo: "assenza",
          gravita: "bloccante",
          data: m.date[g],
          lavoratoreIdx: l,
          messaggio: `${nome} è assente il ${m.date[g]} ma risulta in turno.`,
        })
      }
    }
  }

  // --- Tetto ore settimanale, incluso il contesto ---------------------------
  for (let l = 0; l < m.lavoratori.length; l++) {
    const ore = orePerSettimana(m, s, l)
    for (let settimana = 0; settimana < ore.length; settimana++) {
      if (ore[settimana] <= m.regole.maxOreSettimana + 1e-9) continue
      const nome = nomeCompleto(m.lavoratori[l])
      const primoGiorno = m.settimanaDi.findIndex((indice) => indice === settimana)
      const settimanaDal = primoGiorno >= 0 ? m.date[primoGiorno] : "sconosciuta"
      out.push({
        tipo: "max_ore_settimana",
        gravita: "bloccante",
        lavoratoreIdx: l,
        messaggio: `${nome}: ${ore[settimana].toFixed(1)} ore nella settimana che inizia il ${settimanaDal}, oltre il tetto globale di ${m.regole.maxOreSettimana} ore.`,
        riferimenti: {
          lavoratoreId: m.lavoratori[l].id,
          settimana,
          oreAttuali: ore[settimana],
          soglia: m.regole.maxOreSettimana,
          includeContesto: true,
        },
      })
    }
  }

  // --- Monte ore ------------------------------------------------------------
  const riepiloghiPiano = riepiloghi(m, s, c)
  const oreRichieste = m.slots.reduce((totale, sl) => {
    const t = m.turni[sl.turnoIdx]
    return totale + (t.contaNelleOre ? (t.durataMin * t.pesoOre) / MIN_IN_H : 0)
  }, 0)
  const oreContrattuali = riepiloghiPiano.reduce((totale, r) => totale + r.oreTarget, 0)
  const capacitaEccedente =
    scoperti.size === 0 && oreContrattuali - oreRichieste > 1 / 60

  if (capacitaEccedente) {
    out.push({
      tipo: "capacita_eccedente",
      gravita: "info",
      messaggio: `La copertura è completa: i turni richiedono ${formattaOre(oreRichieste * 60)}, mentre la capacità contrattuale del periodo è ${formattaOre(oreContrattuali * 60)}. Le ore non assegnate non corrispondono a turni mancanti.`,
      riferimenti: {
        oreRichieste,
        oreContrattuali,
        oreEccedenti: oreContrattuali - oreRichieste,
      },
    })
  }

  for (const r of riepiloghiPiano) {
    const scarto = r.oreTotali - r.oreTarget
    if (capacitaEccedente && scarto < 0) continue
    if (Math.abs(scarto) >= 4) {
      out.push({
        tipo: "monte_ore",
        gravita: Math.abs(scarto) >= 8 ? "avviso" : "info",
        lavoratoreIdx: r.lavoratoreIdx,
        messaggio: `${r.nome}: ${formattaOre(r.oreTotali * 60)} nel periodo contro un obiettivo di ${formattaOre(r.oreTarget * 60)} (${scarto > 0 ? "+" : ""}${scarto.toFixed(1)}h).`,
        riferimenti: {
          lavoratoreId: m.lavoratori[r.lavoratoreIdx].id,
          oreAttuali: r.oreTotali,
          oreTarget: r.oreTarget,
        },
      })
    }
  }

  return out
}

export function riepiloghi(m: Modello, s: Stato, c: VincoliCompilati) {
  const nG = m.nGiorni
  const out = []
  const giorniPeriodo = m.fineOffsetPeriodo - m.offsetPeriodo

  for (let l = 0; l < m.lavoratori.length; l++) {
    const L = m.lavoratori[l]
    const base = l * nG
    const oreSett = c.oreOverride.get(l) ?? L.oreSettimanali
    const perCodice: Record<string, number> = {}
    const orePerSettimanaReport = orePerSettimana(m, s, l)
    let minuti = 0
    let notti = 0
    let festiviLavorati = 0
    let giorniLavorati = 0

    for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
      const t = s.turnoDelGiorno[base + g]
      if (t === -1) continue
      const tt = m.turni[t]
      giorniLavorati++
      perCodice[tt.codice] = (perCodice[tt.codice] ?? 0) + 1
      if (tt.isNotte) notti++
      if (m.giornoFestivo[g]) festiviLavorati++
      if (tt.contaNelleOre) {
        const min = tt.durataMin * tt.pesoOre
        minuti += min
      }
    }

    out.push({
      lavoratoreIdx: l,
      nome: nomeCompleto(L),
      oreTotali: minuti / 60,
      oreTarget: (oreSett * giorniPeriodo) / 7,
      turniPerCodice: perCodice,
      notti,
      weekendLavorati: festiviLavorati,
      giorniLavorati,
      orePerSettimana: orePerSettimanaReport,
    })
  }
  return out
}
