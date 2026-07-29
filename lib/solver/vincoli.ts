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
import type { Modello, Stato, Vincolo, Violazione } from "./tipi"

const MIN_IN_H = 60
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
  /** Tetti sul numero di turni di un tipo, nel mese. */
  maxTurni: { lav: number; turno: number; n: number; hard: boolean; peso: number; desc: string }[]
  minTurni: { lav: number; turno: number; n: number; hard: boolean; peso: number; desc: string }[]
  /** Coppie che non devono coincidere nello stesso turno/giorno. */
  separati: { a: number; b: number; hard: boolean; peso: number; desc: string }[]
  /** Coppie che devono stare insieme. */
  insieme: { a: number; b: number; hard: boolean; peso: number; desc: string }[]
  /** Override del monte ore settimanale per singolo lavoratore. */
  oreOverride: Map<number, number>
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
        if (lav === undefined) break
        const turni = risolviTurni(p.turni)
        for (const g of giorniValidi) {
          for (const t of turni) {
            const i = lav * nG * nT + g * nT + t
            if (v.isHard) c.vietato[i] = 1
            else c.preferenza[i] += v.peso // costo positivo = da evitare
          }
        }
        break
      }

      case "preferenza": {
        if (lav === undefined) break
        const turni = risolviTurni(p.turni)
        for (const g of giorniValidi) {
          for (const t of turni) {
            // Premio: costo negativo quando la preferenza è soddisfatta.
            c.preferenza[lav * nG * nT + g * nT + t] -= v.peso
          }
        }
        break
      }

      case "postazione_fissa": {
        if (lav === undefined || !p.postazioni) break
        const consentite = new Set(
          p.postazioni.map((x) => idxPost.get(x)).filter((x): x is number => x !== undefined),
        )
        if (consentite.size === 0) break
        for (let pi = 0; pi < nP; pi++) {
          if (!consentite.has(pi)) c.postVietata[lav * nP + pi] = 1
        }
        break
      }

      case "max_turni":
      case "min_turni": {
        if (lav === undefined || p.n === undefined) break
        const turni = risolviTurni(p.turni)
        for (const t of turni) {
          const voce = { lav, turno: t, n: p.n, hard: v.isHard, peso: v.peso, desc: v.descrizione }
          if (v.kind === "max_turni") c.maxTurni.push(voce)
          else c.minTurni.push(voce)
        }
        break
      }

      case "separati":
      case "insieme": {
        const ids = (p.lavoratori ?? []).map((x) => idxLav.get(x))
        if (ids.length < 2 || ids[0] === undefined || ids[1] === undefined) break
        const voce = {
          a: ids[0],
          b: ids[1],
          hard: v.isHard,
          peso: v.peso,
          desc: v.descrizione,
        }
        if (v.kind === "separati") c.separati.push(voce)
        else c.insieme.push(voce)
        break
      }

      case "ore_override": {
        if (lav === undefined || p.ore_settimana === undefined) break
        c.oreOverride.set(lav, p.ore_settimana)
        break
      }
    }
  }

  return c
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
  const sl = m.slots[slotIdx]
  const g = sl.giornoIdx
  const t = sl.turnoIdx
  const nG = m.nGiorni
  const nT = m.turni.length
  const base = lav * nG

  // 1. Un solo turno al giorno
  if (s.turnoDelGiorno[base + g] !== -1) return false

  // 2. Assenze
  if (m.assente[base + g]) return false
  if (m.assenteSuTurno.has(`${lav}:${g}:${t}`)) return false

  // 3. Abilitazione alla postazione
  if (!m.abilitato[lav * m.postazioni.length + sl.postazioneIdx]) return false
  if (c.postVietata[lav * m.postazioni.length + sl.postazioneIdx]) return false

  // 4. Vincoli rigidi dal DSL
  if (c.vietato[lav * nG * nT + g * nT + t]) return false

  // 5. Riposo minimo rispetto al giorno precedente e al successivo
  if (!riposoOk(m, s, lav, g, t)) return false

  // 6. Giorni consecutivi
  if (!giorniConsecutiviOk(m, s, lav, g)) return false

  // 7. Tetti sul numero di turni (solo quelli rigidi)
  for (const mt of c.maxTurni) {
    if (mt.lav !== lav || mt.turno !== t || !mt.hard) continue
    if (contaTurni(m, s, lav, t) >= mt.n) return false
  }

  // 8. Coppie da tenere separate
  for (const sep of c.separati) {
    if (!sep.hard) continue
    const altro = sep.a === lav ? sep.b : sep.b === lav ? sep.a : -1
    if (altro < 0) continue
    if (s.turnoDelGiorno[altro * nG + g] === t) return false
  }

  return true
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
function giorniConsecutiviOk(m: Modello, s: Stato, lav: number, g: number): boolean {
  const nG = m.nGiorni
  const base = lav * nG
  let serie = 1
  for (let i = g - 1; i >= 0 && s.turnoDelGiorno[base + i] !== -1; i--) serie++
  for (let i = g + 1; i < nG && s.turnoDelGiorno[base + i] !== -1; i++) serie++
  return serie <= m.lavoratori[lav].maxGiorniConsecutivi
}

function contaTurni(m: Modello, s: Stato, lav: number, turno: number): number {
  let n = 0
  const base = lav * m.nGiorni
  for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
    if (s.turnoDelGiorno[base + g] === turno) n++
  }
  return n
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
    const n = contaTurni(m, s, lav, mt.turno)
    if (n > mt.n) costo += (n - mt.n) * mt.peso
  }
  for (const mn of c.minTurni) {
    if (mn.lav !== lav) continue
    const n = contaTurni(m, s, lav, mn.turno)
    if (n < mn.n) costo += (mn.n - n) * mn.peso * (mn.hard ? 10 : 1)
  }

  void nottiTot
  return costo
}

/** Equità: quanto è sbilanciata la distribuzione fra i lavoratori. */
export function costoEquita(m: Modello, s: Stato): number {
  const nL = m.lavoratori.length
  const nG = m.nGiorni
  const notti = new Float64Array(nL)
  const festivi = new Float64Array(nL)
  const minuti = new Float64Array(nL)

  for (let l = 0; l < nL; l++) {
    for (let g = m.offsetPeriodo; g < m.fineOffsetPeriodo; g++) {
      const t = s.turnoDelGiorno[l * nG + g]
      if (t === -1) continue
      const tt = m.turni[t]
      if (tt.isNotte) notti[l]++
      if (m.giornoFestivo[g]) festivi[l]++
      if (tt.contaNelleOre) minuti[l] += tt.durataMin * tt.pesoOre
    }
  }

  // Deviazione standard: penalizza chi si accolla più notti degli altri.
  return (
    deviazione(notti) * m.pesi.equita_notti +
    deviazione(festivi) * m.pesi.equita_weekend +
    (deviazione(minuti) / MIN_IN_H) * m.pesi.equita_ore
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

  const eq = costoEquita(m, s)
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

  // --- Slot scoperti (raggruppati per giorno/turno/postazione) -------------
  const scoperti = new Map<string, { data: string; post: string; turno: string; n: number }>()
  for (const sl of m.slots) {
    if (s.assegnatoA[sl.idx] !== -1) continue
    const k = `${sl.data}:${sl.postazioneIdx}:${sl.turnoIdx}`
    const v = scoperti.get(k)
    if (v) v.n++
    else
      scoperti.set(k, {
        data: sl.data,
        post: m.postazioni[sl.postazioneIdx].nome,
        turno: m.turni[sl.turnoIdx].nome,
        n: 1,
      })
  }
  for (const v of scoperti.values()) {
    out.push({
      tipo: "copertura",
      gravita: "bloccante",
      data: v.data,
      messaggio: `${v.data}: mancano ${v.n} persone su "${v.post}" nel turno ${v.turno}.`,
      riferimenti: { postazione: v.post, turno: v.turno, mancanti: v.n },
    })
  }

  // --- Riposi e serie (le assegnazioni bloccate a mano possono violare) ----
  for (let l = 0; l < m.lavoratori.length; l++) {
    const L = m.lavoratori[l]
    const nome = `${L.nome} ${L.cognome}`
    const base = l * nG

    let serie = 0
    for (let g = 0; g < nG; g++) {
      const t = s.turnoDelGiorno[base + g]
      if (t === -1) {
        serie = 0
        continue
      }
      serie++
      if (serie > L.maxGiorniConsecutivi && g >= m.offsetPeriodo) {
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
        if (stacco < richiesto && g >= m.offsetPeriodo) {
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
      if (m.assente[base + g]) {
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

  // --- Monte ore ------------------------------------------------------------
  for (const r of riepiloghi(m, s, c)) {
    const scarto = r.oreTotali - r.oreTarget
    if (Math.abs(scarto) >= 4) {
      out.push({
        tipo: "monte_ore",
        gravita: Math.abs(scarto) >= 8 ? "avviso" : "info",
        lavoratoreIdx: r.lavoratoreIdx,
        messaggio: `${r.nome}: ${formattaOre(r.oreTotali * 60)} nel mese contro un obiettivo di ${formattaOre(r.oreTarget * 60)} (${scarto > 0 ? "+" : ""}${scarto.toFixed(1)}h).`,
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
    const orePerSettimana = new Array(m.nSettimane).fill(0)
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
        orePerSettimana[m.settimanaDi[g]] += min / 60
      }
    }

    out.push({
      lavoratoreIdx: l,
      nome: `${L.nome} ${L.cognome}`,
      oreTotali: minuti / 60,
      oreTarget: (oreSett * giorniPeriodo) / 7,
      turniPerCodice: perCodice,
      notti,
      weekendLavorati: festiviLavorati,
      giorniLavorati,
      orePerSettimana,
    })
  }
  return out
}
