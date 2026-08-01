import { describe, expect, it } from "vitest"

import {
  ErroreIntervalloPianificazione,
  copreMeseIntero,
  etichettaIntervallo,
  giorniIntervallo,
  intervalloDaParametri,
  intervalloDueMesi,
  limitiMensiliIntervallo,
  mesiIntervallo,
  segnalazioneRilevante,
  validaIntervallo,
} from "./intervallo"

describe("intervallo di pianificazione", () => {
  it("interpreta un vecchio URL mensile come mese completo", () => {
    expect(intervalloDaParametri({ mese: "2026-02-14" })).toEqual({
      dal: "2026-02-01",
      al: "2026-02-28",
    })
  })

  it("mantiene un intervallo personalizzato inclusivo", () => {
    expect(
      intervalloDaParametri({
        mese: "2026-01-01",
        dal: "2026-01-20",
        al: "2026-03-05",
      }),
    ).toEqual({ dal: "2026-01-20", al: "2026-03-05" })
    expect(giorniIntervallo("2026-01-20", "2026-01-22")).toEqual([
      "2026-01-20",
      "2026-01-21",
      "2026-01-22",
    ])
  })

  it("costruisce due mesi completi anche a cavallo dell'anno", () => {
    expect(intervalloDueMesi("2026-12-20")).toEqual({
      dal: "2026-12-01",
      al: "2027-01-31",
    })
  })

  it("elenca senza duplicati tutti i mesi coinvolti", () => {
    expect(mesiIntervallo("2026-12-20", "2027-02-03")).toEqual([
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ])
  })

  it("suddivide un intervallo nei segmenti mensili da persistere", () => {
    expect(limitiMensiliIntervallo("2026-12-20", "2027-02-03")).toEqual([
      { mese: "2026-12-01", dal: "2026-12-20", al: "2026-12-31" },
      { mese: "2027-01-01", dal: "2027-01-01", al: "2027-01-31" },
      { mese: "2027-02-01", dal: "2027-02-01", al: "2027-02-03" },
    ])
  })

  it("mostra le segnalazioni senza ambito o dello stesso intervallo", () => {
    expect(segnalazioneRilevante(null, {}, "2026-08-20", "2026-09-10")).toBe(true)
    expect(
      segnalazioneRilevante(
        null,
        { intervallo: { dal: "2026-08-20", al: "2026-09-10" } },
        "2026-08-20",
        "2026-09-10",
      ),
    ).toBe(true)
    expect(
      segnalazioneRilevante(
        null,
        { intervallo: { dal: "2026-08-20", al: "2026-09-10" } },
        "2026-08-01",
        "2026-08-31",
      ),
    ).toBe(false)
    expect(segnalazioneRilevante("2026-08-25", {}, "2026-08-20", "2026-08-31")).toBe(
      true,
    )
  })

  it("rifiuta date invertite e intervalli oltre il limite", () => {
    expect(() => validaIntervallo("2026-03-02", "2026-03-01")).toThrow(
      ErroreIntervalloPianificazione,
    )
    expect(() => validaIntervallo("2026-01-01", "2027-01-02")).toThrow(
      /massimo 366 giorni/i,
    )
  })

  it("rifiuta date ISO inesistenti", () => {
    expect(() => validaIntervallo("2026-02-30", "2026-03-01")).toThrow(
      ErroreIntervalloPianificazione,
    )
  })

  it("riconosce un intervallo che copre esattamente un mese", () => {
    expect(copreMeseIntero("2026-08-01", "2026-08-31")).toBe(true)
    expect(copreMeseIntero("2026-02-01", "2026-02-28")).toBe(true)
    expect(copreMeseIntero("2026-08-01", "2026-08-30")).toBe(false)
    expect(copreMeseIntero("2026-08-02", "2026-08-31")).toBe(false)
    expect(copreMeseIntero("2026-08-01", "2026-09-30")).toBe(false)
  })

  it("etichetta un mese intero con il nome del mese", () => {
    expect(etichettaIntervallo("2026-08-01", "2026-08-31")).toBe("agosto 2026")
  })

  it("etichetta per esteso gli intervalli parziali e a cavallo di due mesi", () => {
    expect(etichettaIntervallo("2026-08-01", "2026-08-15")).toBe(
      "1 agosto 2026 – 15 agosto 2026",
    )
    expect(etichettaIntervallo("2026-08-01", "2026-09-30")).toBe(
      "1 agosto 2026 – 30 settembre 2026",
    )
  })
})
