import { describe, expect, it, vi } from "vitest"

import { salvaAssenzaConCompatibilita } from "./salvataggio-assenza"

const nuovaAssenza = {
  worker_id: "worker-1",
  dal: "2026-08-03",
  al: "2026-08-03",
  tipo: "disciplinare" as const,
  giornata_intera: true,
}

describe("salvataggio compatibile delle assenze", () => {
  it("salva direttamente quando il tipo canonico è supportato", async () => {
    const inserisci = vi.fn().mockResolvedValue({ error: null })

    await salvaAssenzaConCompatibilita(nuovaAssenza, inserisci)

    expect(inserisci).toHaveBeenCalledTimes(1)
    expect(inserisci).toHaveBeenCalledWith(nuovaAssenza)
  })

  it("ripiega sul formato precedente soltanto se manca il nuovo valore enum", async () => {
    const inserisci = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: "22P02" } })
      .mockResolvedValueOnce({ error: null })

    await salvaAssenzaConCompatibilita(nuovaAssenza, inserisci)

    expect(inserisci).toHaveBeenNthCalledWith(2, {
      ...nuovaAssenza,
      tipo: "altro",
      note: "[stato-piano:disciplinare]",
    })
  })

  it("propaga un errore inatteso senza tentare il fallback", async () => {
    const inserisci = vi.fn().mockResolvedValue({ error: { code: "42501" } })

    await expect(
      salvaAssenzaConCompatibilita(nuovaAssenza, inserisci),
    ).rejects.toThrow("Impossibile salvare l’assenza.")
    expect(inserisci).toHaveBeenCalledTimes(1)
  })

  it("propaga anche il fallimento del salvataggio compatibile", async () => {
    const inserisci = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: "22P02" } })
      .mockResolvedValueOnce({ error: { code: "42501" } })

    await expect(
      salvaAssenzaConCompatibilita(nuovaAssenza, inserisci),
    ).rejects.toThrow("Impossibile salvare l’assenza.")
  })
})
