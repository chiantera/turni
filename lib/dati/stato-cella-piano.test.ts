import { describe, expect, it } from "vitest"

import {
  assenzaCompatibileConSchemaPrecedente,
  etichettaAccessibileCellaLavoratore,
  statoCellaLavoratore,
  type AssenzaCellaPiano,
} from "./stato-cella-piano"

function assenza(
  tipo: AssenzaCellaPiano["tipo"],
  overrides: Partial<AssenzaCellaPiano> = {},
): AssenzaCellaPiano {
  return {
    worker_id: "worker-1",
    dal: "2026-08-10",
    al: "2026-08-10",
    tipo,
    giornata_intera: true,
    shift_type_id: null,
    note: null,
    ...overrides,
  }
}

describe("stato delle celle senza assegnazione nella vista per lavoratore", () => {
  it("descrive in modo accessibile sia stati sia assegnazioni", () => {
    expect(
      etichettaAccessibileCellaLavoratore({
        lavoratore: "Mario Rossi",
        data: "2026-08-03",
        stato: "Riposo",
      }),
    ).toBe("Mario Rossi, 2026-08-03: Riposo. Clicca per modificare.")
    expect(
      etichettaAccessibileCellaLavoratore({
        lavoratore: "Mario Rossi",
        data: "2026-08-03",
        turno: "Mattino",
        postazione: "Reparto A",
      }),
    ).toBe("Mario Rossi, 2026-08-03: Mattino · Reparto A. Clicca per modificare.")
  })

  it.each([
    [[], "R", "Riposo"],
    [[assenza("ferie")], "F", "Ferie"],
    [[assenza("malattia")], "🤒", "Malattia"],
    [[assenza("disciplinare")], "D", "Disciplinare"],
    [[assenza("studio")], "📚", "Permesso per studiare"],
    [[assenza("congedo")], "C", "Congedo parentale"],
    [[assenza("altro")], "A", "Altro"],
  ] as const)("mostra %s come %s", (assenze, codice, etichetta) => {
    expect(
      statoCellaLavoratore({
        workerId: "worker-1",
        data: "2026-08-10",
        assegnazionePresente: false,
        assenze: [...assenze],
      }),
    ).toMatchObject({ codice, etichetta })
  })

  it("dà precedenza a un'assenza giornaliera quando più assenze coprono la data", () => {
    expect(
      statoCellaLavoratore({
        workerId: "worker-1",
        data: "2026-08-10",
        assegnazionePresente: false,
        assenze: [
          assenza("studio", { giornata_intera: false, shift_type_id: "shift-m" }),
          assenza("malattia"),
        ],
      }),
    ).toMatchObject({ codice: "🤒", etichetta: "Malattia" })
  })

  it.each([
    ["disciplinare", "altro", "[stato-piano:disciplinare]", "D"],
    ["studio", "formazione", "[stato-piano:studio]", "📚"],
  ] as const)(
    "mantiene lo stato %s durante un deploy precedente alla migrazione enum",
    (tipo, tipoLegacy, note, codice) => {
      const compatibile = assenzaCompatibileConSchemaPrecedente(tipo)
      expect(compatibile).toEqual({ tipo: tipoLegacy, note })
      expect(
        statoCellaLavoratore({
          workerId: "worker-1",
          data: "2026-08-10",
          assegnazionePresente: false,
          assenze: [assenza(tipoLegacy, { note })],
        }),
      ).toMatchObject({ codice })
    },
  )
})
