/**
 * Utilità temporali per il fuso Europe/Rome, senza dipendenze esterne.
 *
 * Perché serve: un turno di notte 21:00 -> 07:00 attraversa la mezzanotte, e
 * due volte l'anno attraversa anche il cambio dell'ora legale. Ragionare in
 * "minuti dalla mezzanotte" produce risultati sbagliati in quelle notti.
 *
 * Scelta di modello, deliberata e diversa nei due usi:
 *
 *   - ORE CONTABILIZZATE -> durata nominale del turno (`durata_min`).
 *     È quanto prevede il contratto: la notte del cambio d'ora resta "una
 *     notte" e vale 10 ore. Usare il tempo reale farebbe credere al solver
 *     che quella settimana manchi un'ora da recuperare, il che è falso.
 *
 *   - RIPOSO MINIMO -> tempo reale trascorso fra fine turno e inizio del
 *     successivo. Il riposo di 11 ore previsto dal D.Lgs 66/2003 è un minimo
 *     di sicurezza: deve essere reale, non nominale.
 */

export const FUSO = "Europe/Rome"

/** Scarto in millisecondi fra ora locale e UTC per un dato istante. */
function scartoMs(fuso: string, utcMs: number): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const p: Record<string, number> = {}
  for (const { type, value } of fmt.formatToParts(new Date(utcMs))) {
    if (type !== "literal") p[type] = Number(value)
  }
  // Alcuni runtime rendono la mezzanotte come ora 24 con hour12:false.
  const ora = p.hour === 24 ? 0 : p.hour
  const comeSeUtc = Date.UTC(p.year, p.month - 1, p.day, ora, p.minute, p.second)
  return comeSeUtc - utcMs
}

/**
 * Converte un orario "da calendario appeso al muro" nel timestamp UTC reale.
 * La doppia passata corregge le ore a cavallo del cambio ora legale, dove la
 * prima stima userebbe lo scarto sbagliato.
 */
export function localeAUtc(
  anno: number,
  mese: number, // 1-12
  giorno: number,
  ora: number,
  minuto: number,
  fuso: string = FUSO,
): number {
  const stima = Date.UTC(anno, mese - 1, giorno, ora, minuto)
  const primaPassata = stima - scartoMs(fuso, stima)
  return stima - scartoMs(fuso, primaPassata)
}

/** "2026-08-01" -> [2026, 8, 1] */
export function pezziData(iso: string): [number, number, number] {
  return [
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)),
    Number(iso.slice(8, 10)),
  ]
}

/** [2026, 8, 1] -> "2026-08-01" */
export function componiData(anno: number, mese: number, giorno: number): string {
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`
}

/** Somma giorni a una data ISO restando nel calendario civile. */
export function aggiungiGiorni(iso: string, giorni: number): string {
  const [a, m, g] = pezziData(iso)
  const d = new Date(Date.UTC(a, m - 1, g))
  d.setUTCDate(d.getUTCDate() + giorni)
  return componiData(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/** Differenza in giorni fra due date ISO (b - a). */
export function differenzaGiorni(a: string, b: string): number {
  const [aa, am, ag] = pezziData(a)
  const [ba, bm, bg] = pezziData(b)
  return Math.round(
    (Date.UTC(ba, bm - 1, bg) - Date.UTC(aa, am - 1, ag)) / 86_400_000,
  )
}

/** 0 = domenica ... 6 = sabato, coerente con Date.getDay(). */
export function giornoSettimana(iso: string): number {
  const [a, m, g] = pezziData(iso)
  return new Date(Date.UTC(a, m - 1, g)).getUTCDay()
}

export function eWeekend(iso: string): boolean {
  const g = giornoSettimana(iso)
  return g === 0 || g === 6
}

/** Primo giorno del mese di una data ISO. */
export function primoDelMese(iso: string): string {
  const [a, m] = pezziData(iso)
  return componiData(a, m, 1)
}

/** Numero di giorni del mese contenente la data ISO. */
export function giorniNelMese(iso: string): number {
  const [a, m] = pezziData(iso)
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}

/** "07:00" o "07:00:00" -> 420 */
export function oraInMinuti(ora: string): number {
  return Number(ora.slice(0, 2)) * 60 + Number(ora.slice(3, 5))
}

/** Formatta minuti come "38h 30m" per i messaggi all'utente. */
export function formattaOre(minuti: number): string {
  const segno = minuti < 0 ? "-" : ""
  const m = Math.abs(Math.round(minuti))
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${segno}${h}h` : `${segno}${h}h ${r}m`
}
