import { describe, expect, it } from "vitest"

import {
  SchemaSuggerimentiPiano,
  costruisciPromptSuggerimenti,
  type ContestoSuggerimentiPiano,
} from "./suggerimenti-piano"

const contesto: ContestoSuggerimentiPiano = {
  dal: "2026-08-20",
  al: "2026-09-10",
  segnalazioni: [
    {
      gravita: "bloccante",
      tipo: "slot_scoperto",
      messaggio: "Manca un lavoratore per Reparto A, turno N, il 2026-08-15.",
      data: "2026-08-15",
    },
  ],
  lavoratori: [
    {
      nome: "Marco Rossi",
      oreSettimanali: 38,
      postazioni: ["Reparto A"],
    },
  ],
  turni: [{ codice: "N", nome: "Notte" }],
  copertura: [
    {
      postazione: "Reparto A",
      turno: "N",
      giornoSettimana: 6,
      tipoGiorno: "feriale",
      richiesti: 2,
    },
  ],
  assenze: 1,
  vincoli: ["Marco Rossi non fa notti"],
}

describe("suggerimenti AI per un piano con segnalazioni", () => {
  it("costruisce un prompt ancorato ai dati reali senza autorizzare modifiche", () => {
    const prompt = costruisciPromptSuggerimenti(contesto)

    expect(prompt).toContain("Manca un lavoratore per Reparto A")
    expect(prompt).toContain("Marco Rossi")
    expect(prompt).toContain("Marco Rossi non fa notti")
    expect(prompt).toContain('"dal": "2026-08-20"')
    expect(prompt).toContain('"al": "2026-09-10"')
    expect(prompt).toContain("NON modificare dati")
    expect(prompt).toContain("non garantire che una proposta risolva il piano")
  })

  it("accetta solo suggerimenti strutturati e percorsi applicativi noti", () => {
    const valido = SchemaSuggerimentiPiano.safeParse({
      diagnosi: "La domanda notturna supera il personale disponibile.",
      suggerimenti: [
        {
          priorita: "alta",
          titolo: "Ridurre la copertura notturna",
          spiegazione: "Il sabato risultano richieste due persone abilitate.",
          azioni: ["Verificare se la richiesta può scendere da 2 a 1."],
          percorso: "/copertura",
        },
      ],
      limiti: "Serve una nuova esecuzione del solver per verificare il risultato.",
    })
    const percorsoInventato = SchemaSuggerimentiPiano.safeParse({
      diagnosi: "x",
      suggerimenti: [
        {
          priorita: "alta",
          titolo: "x",
          spiegazione: "x",
          azioni: ["x"],
          percorso: "/amministrazione-segreta",
        },
      ],
      limiti: "x",
    })

    expect(valido.success).toBe(true)
    expect(percorsoInventato.success).toBe(false)
  })
})
