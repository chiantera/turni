import { describe, expect, it } from "vitest"
import { generaPiano } from "./index"
import { scenario } from "./scenari"
import { valutaRilassamenti } from "./controfattuali"

const vincoloMax = {
  id: "v-max",
  kind: "max_turni" as const,
  isHard: true,
  peso: 10,
  descrizione: "Massimo zero mattini",
  params: { lavoratore: "l-0", turni: ["t-m"], n: 0 },
}

describe("analisi controfattuale dei vincoli", () => {
  it("misura gli slot recuperati rilassando un vincolo rigido", () => {
    const dati = scenario({
      nLavoratori: 1,
      copertura: [1, 0, 0],
      vincoli: [vincoloMax],
    })
    const baseline = generaPiano(dati, { seme: 1, tempoMaxMs: 0 })

    const risultati = valutaRilassamenti(
      dati,
      { slotScoperti: baseline.slotScoperti },
      [vincoloMax.id],
      { seme: 1, tempoMaxMs: 0 },
    )

    expect(risultati).toHaveLength(1)
    expect(risultati[0]).toMatchObject({
      vincoloId: vincoloMax.id,
      slotScopertiPrima: baseline.slotScoperti,
    })
    expect(risultati[0].slotRecuperati).toBeGreaterThan(0)
    expect(risultati[0].slotScopertiDopo).toBeLessThan(baseline.slotScoperti)
  })

  it("non esegue più esperimenti del limite e scarta ID sconosciuti", () => {
    const dati = scenario({ vincoli: [vincoloMax] })
    const risultati = valutaRilassamenti(
      dati,
      { slotScoperti: 10 },
      ["inesistente", vincoloMax.id],
      { massimoEsperimenti: 1, seme: 1, tempoMaxMs: 0 },
    )

    expect(risultati).toHaveLength(1)
    expect(risultati[0].vincoloId).toBe(vincoloMax.id)
  })
})
