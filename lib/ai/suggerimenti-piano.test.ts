import { describe, expect, it } from "vitest"

import {
  SchemaSuggerimentiPiano,
  costruisciPromptSuggerimenti,
  riduciContestoAllaSegnalazione,
  segnalazioneIdDaCorpo,
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
  it("distingue una richiesta globale da un identificativo valido", () => {
    const id = "5ec3bfaa-6e2a-4eb2-b857-f211047893f6"

    expect(segnalazioneIdDaCorpo({ dal: "2026-08-01" })).toBeNull()
    expect(segnalazioneIdDaCorpo({ segnalazioneId: id })).toBe(id)
    expect(() => segnalazioneIdDaCorpo({ segnalazioneId: "" })).toThrow(
      "Segnalazione non valida",
    )
    expect(() => segnalazioneIdDaCorpo({ segnalazioneId: 42 })).toThrow(
      "Segnalazione non valida",
    )
  })

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

  it("limita il contesto AI alla singola segnalazione e ai dati pertinenti", () => {
    const altraSegnalazione = {
      gravita: "avviso",
      tipo: "monte_ore",
      messaggio: "Luisa Verdi ha troppe ore.",
      data: null,
    }
    const esteso: ContestoSuggerimentiPiano = {
      ...contesto,
      segnalazioni: [
        {
          ...contesto.segnalazioni[0],
          riferimenti: { postazione: "Reparto A", turno: "Notte" },
        },
        altraSegnalazione,
      ],
      lavoratori: [
        ...contesto.lavoratori,
        { nome: "Luisa Verdi", oreSettimanali: 38, postazioni: ["Reparto B"] },
      ],
      turni: [
        ...contesto.turni,
        { codice: "M", nome: "Mattino" },
      ],
      copertura: [
        ...contesto.copertura,
        {
          postazione: "Reparto B",
          turno: "M",
          giornoSettimana: 1,
          tipoGiorno: "feriale",
          richiesti: 1,
        },
      ],
      vincoli: [...contesto.vincoli, "Luisa Verdi non lavora il lunedì"],
    }

    const ridotto = riduciContestoAllaSegnalazione(esteso, esteso.segnalazioni[0])

    expect(ridotto.segnalazioni).toEqual([esteso.segnalazioni[0]])
    expect(ridotto.lavoratori.map((l) => l.nome)).toEqual(["Marco Rossi"])
    expect(ridotto.turni).toEqual([{ codice: "N", nome: "Notte" }])
    expect(ridotto.copertura).toEqual([contesto.copertura[0]])
    expect(ridotto.vincoli).toEqual(["Marco Rossi non fa notti"])
    expect(costruisciPromptSuggerimenti(ridotto)).toContain("SINGOLA SEGNALAZIONE")
  })
})
