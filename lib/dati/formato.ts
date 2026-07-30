/** Formattazione in italiano, condivisa fra server e client. */

const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
]

export const MESI_BREVI = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
]

export const GIORNI_BREVI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"]
export const GIORNI = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
]

/** "2026-08-01" -> "agosto 2026" */
export function nomeMese(iso: string): string {
  const m = Number(iso.slice(5, 7))
  return `${MESI[m - 1]} ${iso.slice(0, 4)}`
}

/** "2026-08-01" -> "1 agosto 2026" */
export function dataEstesa(iso: string): string {
  const g = Number(iso.slice(8, 10))
  const m = Number(iso.slice(5, 7))
  return `${g} ${MESI[m - 1]} ${iso.slice(0, 4)}`
}

/** Primo giorno del mese corrente in Italia, in ISO. */
export function meseCorrente(data = new Date()): string {
  const parti = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(data)
  const anno = parti.find((p) => p.type === "year")?.value
  const mese = parti.find((p) => p.type === "month")?.value
  if (!anno || !mese) throw new Error("Impossibile determinare il mese corrente.")
  return `${anno}-${mese}-01`
}

export function percorsoPianificazioneCorrente(data = new Date()): string {
  return `/pianificazione/${meseCorrente(data)}`
}

/** Sposta di n mesi mantenendo il formato AAAA-MM-01. */
export function spostaMese(iso: string, n: number): string {
  const a = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = new Date(Date.UTC(a, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`
}

/** Anno di una data ISO ("2026-08-01" -> 2026). */
export function annoDiMese(iso: string): number {
  return Number(iso.slice(0, 4))
}

/**
 * I 12 mesi di un anno, in ordine, come primo giorno del mese in ISO.
 * Base del calendario di selezione: mostra un anno intero invece di
 * costringere a scorrere un mese alla volta con "precedente"/"successivo".
 */
export function mesiDellAnno(anno: number): string[] {
  return Array.from(
    { length: 12 },
    (_, i) => `${anno}-${String(i + 1).padStart(2, "0")}-01`,
  )
}

export function ore(n: number): string {
  const arrotondato = Math.round(n * 10) / 10
  return `${arrotondato.toString().replace(".", ",")} h`
}
