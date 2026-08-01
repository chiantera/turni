import { describe, expect, it } from "vitest"

import { oreAssegnate } from "./statistiche"

const MATTINO = {
  id: "m",
  durata_min: 420,
  peso_ore: 1,
  conta_nelle_ore: true,
}
const NOTTE = {
  id: "n",
  durata_min: 600,
  peso_ore: 1,
  conta_nelle_ore: true,
}
const REPERIBILITA = {
  id: "r",
  durata_min: 600,
  peso_ore: 0.25,
  conta_nelle_ore: true,
}
const RIPOSO = {
  id: "x",
  durata_min: 480,
  peso_ore: 1,
  conta_nelle_ore: false,
}

const TURNI = [MATTINO, NOTTE, REPERIBILITA, RIPOSO]

describe("oreAssegnate", () => {
  it("somma le durate dei turni contabilizzati", () => {
    const ore = oreAssegnate(
      [{ shift_type_id: "m" }, { shift_type_id: "m" }, { shift_type_id: "n" }],
      TURNI,
    )
    expect(ore).toBe(24) // 7 + 7 + 10
  })

  it("esclude i turni che non contano nelle ore", () => {
    const ore = oreAssegnate([{ shift_type_id: "m" }, { shift_type_id: "x" }], TURNI)
    expect(ore).toBe(7)
  })

  it("applica il peso ore dei turni parziali", () => {
    const ore = oreAssegnate([{ shift_type_id: "r" }], TURNI)
    expect(ore).toBe(2.5) // 600 min * 0.25
  })

  it("ignora le assegnazioni con un turno sconosciuto", () => {
    const ore = oreAssegnate(
      [{ shift_type_id: "m" }, { shift_type_id: "cancellato" }],
      TURNI,
    )
    expect(ore).toBe(7)
  })

  it("vale zero senza assegnazioni", () => {
    expect(oreAssegnate([], TURNI)).toBe(0)
  })
})
