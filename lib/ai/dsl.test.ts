import { describe, expect, it } from "vitest"
import {
  SchemaEstrazione,
  problemiDiCoerenza,
  risolviNome,
  type VincoloEstratto,
} from "./dsl"

const LAVORATORI = [
  { id: "1", etichetta: "Marco Rossi" },
  { id: "2", etichetta: "Giulia Bianchi" },
  { id: "3", etichetta: "Luca Ferrari" },
  { id: "4", etichetta: "Marco Verdi" },
  { id: "5", etichetta: "Chiara Colombo" },
]

describe("risoluzione dei nomi", () => {
  it("riconosce il nome completo", () => {
    const r = risolviNome("Marco Rossi", LAVORATORI)
    expect(r.id).toBe("1")
    expect(r.confidenza).toBe(1)
  })

  it("è insensibile a maiuscole e accenti", () => {
    expect(risolviNome("giulia bianchi", LAVORATORI).id).toBe("2")
    expect(risolviNome("GIULIA BIANCHI", LAVORATORI).id).toBe("2")
  })

  it("riconosce il solo cognome se non ambiguo", () => {
    expect(risolviNome("Ferrari", LAVORATORI).id).toBe("3")
    expect(risolviNome("Bianchi", LAVORATORI).id).toBe("2")
  })

  it("tollera piccoli errori di battitura", () => {
    expect(risolviNome("Guilia Bianchi", LAVORATORI).id).toBe("2")
  })

  it("NON indovina quando il nome è ambiguo", () => {
    // Ci sono due Marco: rispondere a caso manderebbe in ferie la persona
    // sbagliata. Meglio dichiarare l'ambiguità.
    const r = risolviNome("Marco", LAVORATORI)
    expect(r.id).toBeNull()
    expect(r.alternative.length).toBeGreaterThan(1)
  })

  it("restituisce null per un nome inesistente", () => {
    const r = risolviNome("Alessandro Neri", LAVORATORI)
    expect(r.id).toBeNull()
  })

  it("gestisce input vuoto o elenco vuoto", () => {
    expect(risolviNome("", LAVORATORI).id).toBeNull()
    expect(risolviNome("Marco Rossi", []).id).toBeNull()
  })
})

// ---------------------------------------------------------------------------

function vincolo(p: Partial<VincoloEstratto>): VincoloEstratto {
  return {
    kind: "indisponibile",
    descrizione: "prova",
    is_hard: true,
    lavoratore: null,
    lavoratori: null,
    giorni: null,
    date: null,
    turni: null,
    postazioni: null,
    n: null,
    ore_settimana: null,
    valido_dal: null,
    valido_al: null,
    ...p,
  }
}

describe("coerenza dei vincoli", () => {
  it("accetta un indisponibile ben formato", () => {
    const v = vincolo({
      kind: "indisponibile",
      lavoratore: "Marco Rossi",
      giorni: [0],
      turni: ["P"],
    })
    expect(problemiDiCoerenza(v)).toEqual([])
  })

  it("rifiuta un indisponibile senza giorni né date", () => {
    const v = vincolo({ kind: "indisponibile", lavoratore: "Marco Rossi" })
    expect(problemiDiCoerenza(v)).toContain("serve almeno un giorno o una data")
  })

  it("rifiuta max_turni senza quantità", () => {
    const v = vincolo({ kind: "max_turni", lavoratore: "Marco Rossi", turni: ["N"] })
    expect(problemiDiCoerenza(v)).toContain("manca il numero di turni")
  })

  it("rifiuta 'separati' senza due persone", () => {
    const v = vincolo({ kind: "separati", lavoratori: ["Marco Rossi"] })
    expect(problemiDiCoerenza(v)).toContain("servono esattamente due lavoratori")
  })

  it("rifiuta le date mal formate", () => {
    const v = vincolo({
      kind: "indisponibile",
      lavoratore: "Marco Rossi",
      date: ["15/08/2026"],
    })
    expect(problemiDiCoerenza(v).join(" ")).toContain("data non valida")
  })

  it("rifiuta ore_override senza le ore", () => {
    const v = vincolo({ kind: "ore_override", lavoratore: "Marco Rossi" })
    expect(problemiDiCoerenza(v)).toContain("mancano le ore settimanali")
  })
})

describe("schema di estrazione", () => {
  it("valida una risposta ben formata", () => {
    const esito = SchemaEstrazione.safeParse({
      vincoli: [
        {
          kind: "indisponibile",
          descrizione: "Marco Rossi non lavora la domenica pomeriggio",
          is_hard: true,
          lavoratore: "Marco Rossi",
          lavoratori: null,
          giorni: [0],
          date: null,
          turni: ["P"],
          postazioni: null,
          n: null,
          ore_settimana: null,
          valido_dal: null,
          valido_al: null,
        },
      ],
      riepilogo: "Ho capito che Marco Rossi vuole la domenica pomeriggio libera.",
      serve_chiarimento: false,
      domanda: null,
    })
    expect(esito.success).toBe(true)
  })

  it("rifiuta un kind fuori dall'insieme chiuso", () => {
    const esito = SchemaEstrazione.safeParse({
      vincoli: [{ kind: "esegui_sql", descrizione: "x", is_hard: true }],
      riepilogo: "x",
      serve_chiarimento: false,
      domanda: null,
    })
    expect(esito.success).toBe(false)
  })

  it("rifiuta giorni della settimana fuori intervallo", () => {
    const esito = SchemaEstrazione.safeParse({
      vincoli: [
        {
          kind: "indisponibile",
          descrizione: "x",
          is_hard: true,
          lavoratore: "Marco Rossi",
          lavoratori: null,
          giorni: [9],
          date: null,
          turni: null,
          postazioni: null,
          n: null,
          ore_settimana: null,
          valido_dal: null,
          valido_al: null,
        },
      ],
      riepilogo: "x",
      serve_chiarimento: false,
      domanda: null,
    })
    expect(esito.success).toBe(false)
  })
})
