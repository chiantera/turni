import { describe, expect, it } from "vitest"

import { componiAttivita, type FontiAttivita } from "./attivita"

const VUOTE: FontiAttivita = { piani: [], lavoratori: [], postazioni: [] }

function piano(over: Partial<FontiAttivita["piani"][number]> = {}) {
  return {
    id: "p1",
    dal: "2026-08-01",
    al: "2026-08-31",
    versione: 1,
    aggiornato_il: "2026-07-30T09:00:00+00:00",
    ...over,
  }
}

describe("componiAttivita", () => {
  it("ordina le voci dalla più recente alla più vecchia", () => {
    const voci = componiAttivita({
      piani: [piano({ aggiornato_il: "2026-07-20T09:00:00+00:00" })],
      lavoratori: [
        {
          id: "l1",
          nome: "Marco",
          cognome: "Rossi",
          creato_il: "2026-07-31T09:00:00+00:00",
        },
      ],
      postazioni: [
        { id: "s1", nome: "Reception", creato_il: "2026-07-25T09:00:00+00:00" },
      ],
    })

    expect(voci.map((v) => v.tipo)).toEqual(["lavoratore", "postazione", "piano"])
  })

  it("taglia al limite richiesto", () => {
    const lavoratori = Array.from({ length: 8 }, (_, i) => ({
      id: `l${i}`,
      nome: "Marco",
      cognome: `Rossi${i}`,
      creato_il: `2026-07-0${i + 1}T09:00:00+00:00`,
    }))

    expect(componiAttivita({ ...VUOTE, lavoratori }, 3)).toHaveLength(3)
  })

  it("chiama per nome un piano che copre un mese intero", () => {
    const [voce] = componiAttivita({ ...VUOTE, piani: [piano()] })
    expect(voce.descrizione).toBe("Piano agosto 2026 generato")
  })

  it("scrive per esteso un piano che non copre un mese intero", () => {
    const [voce] = componiAttivita({
      ...VUOTE,
      piani: [piano({ al: "2026-08-15" })],
    })
    expect(voce.descrizione).toBe("Piano 1 agosto 2026 – 15 agosto 2026 generato")
  })

  it("distingue un piano rigenerato da uno appena creato", () => {
    const [voce] = componiAttivita({ ...VUOTE, piani: [piano({ versione: 3 })] })
    expect(voce.descrizione).toBe("Piano agosto 2026 aggiornato")
  })

  it("presenta il lavoratore per cognome e nome", () => {
    const [voce] = componiAttivita({
      ...VUOTE,
      lavoratori: [
        {
          id: "l1",
          nome: "Marco",
          cognome: "Rossi",
          creato_il: "2026-07-31T09:00:00+00:00",
        },
      ],
    })
    expect(voce.descrizione).toBe("Lavoratore «Rossi Marco» aggiunto")
  })

  it("distingue gli id di tabelle diverse", () => {
    const voci = componiAttivita({
      piani: [],
      lavoratori: [
        {
          id: "stesso",
          nome: "Marco",
          cognome: "Rossi",
          creato_il: "2026-07-31T09:00:00+00:00",
        },
      ],
      postazioni: [
        { id: "stesso", nome: "Reception", creato_il: "2026-07-25T09:00:00+00:00" },
      ],
    })

    expect(new Set(voci.map((v) => v.id)).size).toBe(2)
  })

  it("non produce nulla senza dati", () => {
    expect(componiAttivita(VUOTE)).toEqual([])
  })
})
