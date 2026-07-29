import { describe, expect, it } from "vitest"

import {
  azioniIntestazioneLavoratore,
  azioniIntestazionePostazione,
  destinazioneDopoAccesso,
  vociNavigazione,
} from "./navigazione"

describe("menu principale", () => {
  it("lascia Pianifica fuori dal menu perché resta visibile nella barra", () => {
    expect(vociNavigazione()).toEqual([
      { href: "/riepilogo", etichetta: "Riepilogo" },
      { href: "/lavoratori", etichetta: "Lavoratori" },
      { href: "/postazioni", etichetta: "Postazioni" },
      { href: "/turni", etichetta: "Turni" },
      { href: "/copertura", etichetta: "Copertura" },
      { href: "/vincoli", etichetta: "Vincoli" },
      { href: "/impostazioni", etichetta: "Impostazioni" },
    ])
  })
})

describe("destinazione dopo l'accesso", () => {
  it("preserva l'intervallo selezionato", () => {
    expect(
      destinazioneDopoAccesso({
        da: "/pianificazione/2026-08-01",
        dal: "2026-08-20",
        al: "2026-10-05",
      }),
    ).toBe("/pianificazione/2026-08-01?dal=2026-08-20&al=2026-10-05")
  })

  it("rifiuta redirect verso domini esterni", () => {
    expect(destinazioneDopoAccesso({ da: "https://example.com" })).toBe("/")
    expect(destinazioneDopoAccesso({ da: "//example.com" })).toBe("/")
  })
})

describe("azioni delle intestazioni del piano", () => {
  it("collega un lavoratore ai suoi dati e al riepilogo", () => {
    expect(azioniIntestazioneLavoratore("worker-1")).toEqual([
      { etichetta: "Dati lavoratore", href: "/lavoratori#lavoratore-worker-1" },
      { etichetta: "Riepilogo", href: "/riepilogo" },
    ])
  })

  it("collega postazione e turno alle relative configurazioni", () => {
    expect(azioniIntestazionePostazione("position-1", "shift-1")).toEqual([
      { etichetta: "Dati postazione", href: "/postazioni#postazione-position-1" },
      { etichetta: "Dati turno", href: "/turni#turno-shift-1" },
      {
        etichetta: "Copertura",
        href: "/copertura#copertura-position-1-shift-1",
      },
      { etichetta: "Riepilogo", href: "/riepilogo" },
    ])
  })
})
