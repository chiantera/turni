import { describe, expect, it } from "vitest"
import {
  aggiungiGiorni,
  differenzaGiorni,
  formattaOre,
  giorniNelMese,
  giornoSettimana,
  localeAUtc,
  oraInMinuti,
} from "./tempo"

const ORA = 3_600_000

describe("conversione fuso orario", () => {
  it("gestisce l'ora solare (inverno)", () => {
    // Il 15 gennaio l'Italia è a UTC+1: le 07:00 locali sono le 06:00 UTC.
    const ms = localeAUtc(2026, 1, 15, 7, 0)
    expect(new Date(ms).toISOString()).toBe("2026-01-15T06:00:00.000Z")
  })

  it("gestisce l'ora legale (estate)", () => {
    // Il 15 luglio l'Italia è a UTC+2.
    const ms = localeAUtc(2026, 7, 15, 7, 0)
    expect(new Date(ms).toISOString()).toBe("2026-07-15T05:00:00.000Z")
  })

  it("misura correttamente la notte in cui scatta l'ora legale", () => {
    // 29 marzo 2026: alle 02:00 le lancette vanno alle 03:00.
    // Un turno 21:00 -> 07:00 quella notte dura 9 ore REALI, non 10.
    const inizio = localeAUtc(2026, 3, 28, 21, 0)
    const fine = localeAUtc(2026, 3, 29, 7, 0)
    expect((fine - inizio) / ORA).toBe(9)
  })

  it("misura correttamente la notte in cui torna l'ora solare", () => {
    // 25 ottobre 2026: alle 03:00 le lancette tornano alle 02:00 -> 11 ore.
    const inizio = localeAUtc(2026, 10, 24, 21, 0)
    const fine = localeAUtc(2026, 10, 25, 7, 0)
    expect((fine - inizio) / ORA).toBe(11)
  })
})

describe("aritmetica sul calendario", () => {
  it("somma giorni attraversando il cambio d'ora senza slittare", () => {
    expect(aggiungiGiorni("2026-03-28", 1)).toBe("2026-03-29")
    expect(aggiungiGiorni("2026-10-24", 1)).toBe("2026-10-25")
    expect(aggiungiGiorni("2026-12-31", 1)).toBe("2027-01-01")
    expect(aggiungiGiorni("2026-08-01", -7)).toBe("2026-07-25")
  })

  it("calcola le differenze in giorni", () => {
    expect(differenzaGiorni("2026-08-01", "2026-08-31")).toBe(30)
    expect(differenzaGiorni("2026-08-01", "2026-07-25")).toBe(-7)
  })

  it("riconosce il giorno della settimana", () => {
    // 1 agosto 2026 è un sabato.
    expect(giornoSettimana("2026-08-01")).toBe(6)
    expect(giornoSettimana("2026-08-02")).toBe(0) // domenica
  })

  it("conta i giorni del mese, bisestili inclusi", () => {
    expect(giorniNelMese("2026-08-10")).toBe(31)
    expect(giorniNelMese("2026-02-10")).toBe(28)
    expect(giorniNelMese("2028-02-10")).toBe(29)
  })
})

describe("formattazione", () => {
  it("converte gli orari in minuti", () => {
    expect(oraInMinuti("07:00")).toBe(420)
    expect(oraInMinuti("21:00:00")).toBe(1260)
    expect(oraInMinuti("14:30")).toBe(870)
  })

  it("formatta le ore in modo leggibile", () => {
    expect(formattaOre(38 * 60)).toBe("38h")
    expect(formattaOre(38 * 60 + 30)).toBe("38h 30m")
    expect(formattaOre(-120)).toBe("-2h")
  })
})
