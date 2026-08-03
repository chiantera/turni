import { describe, expect, it } from "vitest"

import { generaPiano } from "./index"
import { scenarioArticolato } from "./scenari-articolati"

describe("scenario con turni articolati", () => {
  // Regressione. Prima di questo controllo la fattibilità confrontava solo le
  // ore totali dell'organico contro il fabbisogno totale: rispondeva "si può
  // fare" e poi il piano usciva con decine di turni scoperti, perché le
  // mansioni di responsabilità pescano tutte dallo stesso piccolo bacino.
  it("segnala le abilitazioni insufficienti PRIMA di generare", () => {
    const esito = generaPiano(scenarioArticolato({ nAbilitatiResponsabilita: 4 }), { seme: 1 })

    expect(esito.fattibilita.ok).toBe(false)
    const avviso = esito.fattibilita.avvisi.find((a) => a.startsWith("Abilitazioni insufficienti"))
    expect(avviso).toBeDefined()
    expect(avviso).toContain("Responsabile turno")
    expect(avviso).toMatch(/Servono almeno \d+ abilitati in più/)

    // La diagnosi deve corrispondere alla realtà: se avverte, i buchi ci sono.
    expect(esito.slotScoperti).toBeGreaterThan(0)
  })

  it("chiude il mese quando l'organico basta", () => {
    const dati = scenarioArticolato({ nOss: 24, nAbilitatiResponsabilita: 12 })
    const t0 = Date.now()
    const esito = generaPiano(dati, { seme: 1 })
    const ms = Date.now() - t0

    expect(esito.fattibilita.ok).toBe(true)
    expect(esito.slotScoperti).toBe(0)
    // La forma articolata non è un problema di prestazioni: 18 sigle per 8
    // mansioni si risolvono nello stesso ordine di grandezza del caso canonico.
    expect(ms).toBeLessThan(30_000)
  })

  it("è deterministico anche con molte sigle", () => {
    const dati = scenarioArticolato({ nOss: 24, nAbilitatiResponsabilita: 12 })
    const a = generaPiano(dati, { seme: 7 })
    const b = generaPiano(dati, { seme: 7 })
    expect(a.slotScoperti).toBe(b.slotScoperti)
    expect(a.costo).toBe(b.costo)
  })
})
