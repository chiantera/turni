import { describe, expect, it } from "vitest"

import { percorsoPianificazioneCorrente } from "./formato"

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
