import { describe, expect, it } from "vitest"

import { MAX_LUNGHEZZA_EMAIL, normalizzaEmail } from "./newsletter"

describe("normalizzaEmail", () => {
  it("accetta un indirizzo ordinario", () => {
    expect(normalizzaEmail("marco@azienda.it")).toBe("marco@azienda.it")
  })

  it("toglie gli spazi ai lati e abbassa le maiuscole", () => {
    expect(normalizzaEmail("  Marco.Rossi@Azienda.IT ")).toBe("marco.rossi@azienda.it")
  })

  it("scarta ciò che non ha la forma di un indirizzo", () => {
    for (const valore of ["", "   ", "marco", "marco@", "@azienda.it", "marco@azienda", "marco @azienda.it", "marco@@azienda.it"]) {
      expect(normalizzaEmail(valore), valore).toBeNull()
    }
  })

  it("scarta i valori che non sono stringhe", () => {
    for (const valore of [null, undefined, 42, {}, ["a@b.it"]]) {
      expect(normalizzaEmail(valore)).toBeNull()
    }
  })

  it("rifiuta gli indirizzi oltre il limite della RFC", () => {
    const coda = "@azienda.it"
    const giusto = "a".repeat(MAX_LUNGHEZZA_EMAIL - coda.length) + coda
    expect(normalizzaEmail(giusto)).toBe(giusto)
    expect(normalizzaEmail("a" + giusto)).toBeNull()
  })

  it("non si lascia ingannare dagli spazi interni", () => {
    expect(normalizzaEmail("mar co@azienda.it")).toBeNull()
    expect(normalizzaEmail("marco@azi enda.it")).toBeNull()
  })
})
