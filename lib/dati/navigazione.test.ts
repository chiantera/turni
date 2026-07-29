import { describe, expect, it } from "vitest"

import { vociNavigazione } from "./navigazione"

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
