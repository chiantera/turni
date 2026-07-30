import { describe, expect, it } from "vitest"

import {
  MESI_BREVI,
  annoDiMese,
  mesiDellAnno,
  percorsoPianificazioneCorrente,
} from "./formato"

describe("destinazione iniziale", () => {
  it("porta sempre alla pianificazione del mese corrente in Italia", () => {
    expect(percorsoPianificazioneCorrente(new Date("2026-07-28T12:00:00Z"))).toBe(
      "/pianificazione/2026-07-01",
    )
  })

  it("usa il nuovo mese appena scatta in Italia anche se in UTC è ancora il giorno prima", () => {
    expect(percorsoPianificazioneCorrente(new Date("2026-07-31T22:30:00Z"))).toBe(
      "/pianificazione/2026-08-01",
    )
  })
})

describe("calendario per anno", () => {
  it("estrae l'anno da una data ISO", () => {
    expect(annoDiMese("2026-08-01")).toBe(2026)
    expect(annoDiMese("2026-12-25")).toBe(2026)
    expect(annoDiMese("1999-01-15")).toBe(1999)
  })

  it("elenca i 12 mesi di un anno, in ordine, come primo giorno del mese", () => {
    const mesi = mesiDellAnno(2026)
    expect(mesi).toHaveLength(12)
    expect(mesi[0]).toBe("2026-01-01")
    expect(mesi[7]).toBe("2026-08-01")
    expect(mesi[11]).toBe("2026-12-01")
  })

  it("funziona anche a cavallo del millennio, senza troncare l'anno", () => {
    expect(mesiDellAnno(2000)[0]).toBe("2000-01-01")
  })

  it("ha un'etichetta breve per ciascuno dei 12 mesi", () => {
    expect(MESI_BREVI).toHaveLength(12)
    expect(MESI_BREVI[0]).toBe("gen")
    expect(MESI_BREVI[7]).toBe("ago")
    expect(MESI_BREVI[11]).toBe("dic")
  })
})
