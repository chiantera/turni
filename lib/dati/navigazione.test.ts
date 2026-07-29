import { describe, expect, it } from "vitest"

import { vociNavigazione } from "./navigazione"

describe("menu principale", () => {
  it("contiene tutte le destinazioni richieste nell'ordine stabilito", () => {
    expect(vociNavigazione(new Date("2026-07-28T12:00:00Z"))).toEqual([
      { href: "/riepilogo", etichetta: "Riepilogo" },
      { href: "/lavoratori", etichetta: "Lavoratori" },
      { href: "/postazioni", etichetta: "Postazioni" },
      { href: "/turni", etichetta: "Turni" },
      { href: "/copertura", etichetta: "Copertura" },
      { href: "/vincoli", etichetta: "Vincoli" },
      { href: "/impostazioni", etichetta: "Impostazioni" },
      { href: "/pianificazione/2026-07-01", etichetta: "Pianifica" },
    ])
  })
})
