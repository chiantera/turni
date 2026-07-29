import { describe, expect, it } from "vitest"

import {
  ErroreIntervalloPianificazione,
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
})
