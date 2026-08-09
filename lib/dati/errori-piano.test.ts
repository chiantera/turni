import { describe, expect, it } from "vitest"

import { interpretaErrorePiano } from "./errori-piano"

const RIPIEGO = "Salvataggio non riuscito."

describe("interpretaErrorePiano", () => {
  it("distingue un'assegnazione bloccata da un piano obsoleto", () => {
    // Con 40001 i due casi erano indistinguibili e l'utente leggeva sempre
    // "il piano è cambiato", anche quando il problema era un lucchetto.
    const bloccata = interpretaErrorePiano(
      { code: "P0001", message: "ASSEGNAZIONE_BLOCCATA" },
      RIPIEGO,
    )
    const obsoleto = interpretaErrorePiano(
      { code: "P0001", message: "PIANO_OBSOLETO" },
      RIPIEGO,
    )

    expect(bloccata.messaggio).toContain("bloccata")
    expect(obsoleto.messaggio).toContain("Ricarica")
    expect(bloccata.messaggio).not.toBe(obsoleto.messaggio)
  })

  it("assegna 409 ai conflitti e 400 alle richieste sbagliate", () => {
    expect(interpretaErrorePiano({ message: "PIANO_OBSOLETO" }, RIPIEGO).stato).toBe(409)
    expect(interpretaErrorePiano({ message: "ASSEGNAZIONE_BLOCCATA" }, RIPIEGO).stato).toBe(409)
    expect(interpretaErrorePiano({ message: "CELLA_FUORI_INTERVALLO" }, RIPIEGO).stato).toBe(400)
  })

  it("riconosce i permessi negati e il piano assente dal solo SQLSTATE", () => {
    expect(interpretaErrorePiano({ code: "42501", message: "permission denied" }, RIPIEGO).stato).toBe(403)
    expect(interpretaErrorePiano({ code: "P0002", message: "boh" }, RIPIEGO).stato).toBe(404)
  })

  it("ripiega su 400 e sul messaggio generico quando l'errore è sconosciuto", () => {
    const esito = interpretaErrorePiano({ code: "XX000", message: "internal" }, RIPIEGO)
    expect(esito.stato).toBe(400)
    expect(esito.messaggio).toBe(RIPIEGO)
  })

  it("non tratta più 40001 come un caso previsto", () => {
    // Se qualcuno reintroducesse serialization_failure per una regola di
    // dominio, non deve trovare qui una mappatura che lo faccia sembrare sano:
    // quel codice ha causato 135 milioni di transazioni abortite.
    const esito = interpretaErrorePiano({ code: "40001", message: "qualcosa" }, RIPIEGO)
    expect(esito.stato).toBe(400)
    expect(esito.messaggio).toBe(RIPIEGO)
  })
})
