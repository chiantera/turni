import { describe, expect, it } from "vitest"
import { serializzaDatiPerImpronta } from "./serializzazione"
import { scenario } from "./scenari"

describe("impronta dei dati solver", () => {
  it("ignora le assegnazioni solver del periodo ma conserva i blocchi manuali", () => {
    const base = scenario()
    const conRisultato = {
      ...base,
      assegnazioniEsistenti: [
        {
          data: "2026-08-01",
          worker_id: "l-0",
          shift_type_id: "t-m",
          position_id: "p-0",
          bloccato: false,
        },
      ],
    }
    expect(serializzaDatiPerImpronta(base)).toBe(
      serializzaDatiPerImpronta(conRisultato),
    )

    const bloccata = {
      ...conRisultato,
      assegnazioniEsistenti: [{ ...conRisultato.assegnazioniEsistenti[0], bloccato: true }],
    }
    expect(serializzaDatiPerImpronta(base)).not.toBe(
      serializzaDatiPerImpronta(bloccata),
    )
  })

  it("produce la stessa serializzazione indipendentemente dall'ordine delle chiavi", () => {
    const dati = scenario()
    const riordinati = {
      ...dati,
      regole: {
        maxOreSettimana: dati.regole.maxOreSettimana,
        maxGiorniConsecutivi: dati.regole.maxGiorniConsecutivi,
        riposoDopoNotteOre: dati.regole.riposoDopoNotteOre,
        riposoMinOre: dati.regole.riposoMinOre,
      },
    }
    expect(serializzaDatiPerImpronta(dati)).toBe(
      serializzaDatiPerImpronta(riordinati),
    )
  })
})
