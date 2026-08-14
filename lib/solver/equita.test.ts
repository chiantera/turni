import { describe, expect, it } from "vitest"

import { generaPiano, type DatiIngresso, type EsitoCompleto } from "./index"
import { PESI_DEFAULT } from "./modello"
import { scenario } from "./scenari"

/**
 * Equità delle ore fra lavoratori.
 *
 * Il test che già esisteva («distribuisce le notti equamente») usa lo scenario
 * canonico da 7 lavoratori, dove il ciclo a squadre pareggia da solo per
 * costruzione: non avrebbe potuto fallire. Qui l'organico non è multiplo di 7,
 * il ciclo non chiude, e la distribuzione la decide la ricerca locale.
 *
 * Si misura sempre il **residuo** `oreTotali − oreTarget`, mai le ore assolute.
 * Con contratti diversi le ore assolute sono la metrica sbagliata — è
 * esattamente l'errore che `costoEquita()` conteneva: la deviazione standard è
 * invariante per traslazione, quindi sottrarre un target uguale per tutti non
 * cambia nulla, ma con contratti diversi cambia il verso della spinta.
 *
 * Budget in **iterazioni**, non in millisecondi: solo così la ricerca locale è
 * riproducibile (vedi README, «Il solver»). Le sole fasi costruttive non
 * basterebbero — lasciano due persone a zero ore su nove, e la ricerca è
 * proprio ciò che lo ripara.
 */

const BUDGET = { tempoMaxMs: 60_000, iterazioniMax: 120_000 } as const

function pianifica(dati: DatiIngresso, seme: number): EsitoCompleto {
  return generaPiano(dati, { seme, ...BUDGET })
}

function scarti(e: EsitoCompleto): number[] {
  return e.riepiloghi.map((r) => r.oreTotali - r.oreTarget)
}

describe("equità delle ore, contratti uguali", () => {
  // Con `equita_ore` a 20 lo scarto fra la persona più carica e la meno carica
  // arrivava a 11h sullo stesso mese; a 100 resta entro 7h. La soglia sta in
  // mezzo apposta: deve poter fallire se il peso torna indietro.
  it("nessuno lavora molto più degli altri, a parità di contratto", () => {
    for (const nLavoratori of [8, 9, 10]) {
      for (const seme of [1, 7, 42]) {
        const s = scarti(pianifica(scenario({ nLavoratori }), seme))
        const dispersione = Math.max(...s) - Math.min(...s)
        expect(
          dispersione,
          `${nLavoratori} lavoratori, seme ${seme}: scarti ${s.map((x) => x.toFixed(1)).join(", ")}`,
        ).toBeLessThanOrEqual(8)
      }
    }
  })

  it("non costa copertura", () => {
    // Il bilanciamento è una preferenza fra candidati ammissibili: non deve
    // lasciare scoperto uno slot che prima veniva coperto.
    for (const nLavoratori of [8, 9, 10]) {
      const e = pianifica(scenario({ nLavoratori }), 1)
      expect(e.violazioni.filter((v) => v.tipo === "scoperta")).toEqual([])
    }
  })
})

describe("equità delle ore, contratti diversi", () => {
  // Un part-time a metà monte ore. Misurato in ore assolute risulterebbe
  // «sbilanciato» anche stando perfettamente in pari, e il solver avrebbe un
  // incentivo a caricarlo per ridurre la deviazione standard.
  function conPartTime(): DatiIngresso {
    const d = scenario({ nLavoratori: 9 })
    d.lavoratori[0].ore_settimanali = 19
    return d
  }

  it("il part-time lavora meno, non come gli altri", () => {
    const e = pianifica(conPartTime(), 1)
    const partTime = e.riepiloghi[0]
    const pieni = e.riepiloghi.slice(1)
    const oreMediePiene = pieni.reduce((a, r) => a + r.oreTotali, 0) / pieni.length

    expect(partTime.oreTarget).toBeLessThan(pieni[0].oreTarget)
    expect(partTime.oreTotali).toBeLessThan(oreMediePiene)
  })

  it("un contratto più piccolo non diventa un trattamento peggiore", () => {
    // La definizione di equità che vogliamo: non ore uguali, ma uguale
    // scostamento dal proprio contratto. Il part-time non deve finire più
    // indietro di tutti gli altri.
    for (const seme of [1, 7, 42]) {
      const s = scarti(pianifica(conPartTime(), seme))
      const peggiorePieno = Math.min(...s.slice(1))
      expect(s[0], `seme ${seme}: scarti ${s.map((x) => x.toFixed(1)).join(", ")}`)
        .toBeGreaterThanOrEqual(peggiorePieno - 1e-9)
    }
  })
})

describe("i pesi di default", () => {
  it("tengono l'equità delle ore alla pari col rispetto del contratto", () => {
    // Non è un dettaglio di taratura: a 20 la dispersione misurata era il 30%
    // più larga. Se qualcuno riabbassa questo peso, il test sopra fallisce e
    // questo dice perché.
    expect(PESI_DEFAULT.equita_ore).toBe(PESI_DEFAULT.ore_target)
  })
})
