/**
 * Test d'integrazione: chiama davvero il provider AI.
 *
 * Si salta da solo se manca la chiave, così la suite resta eseguibile senza
 * rete e senza credenziali. Serve a verificare la cosa che i test con schemi
 * finti non possono verificare: che il modello REALE, con il prompt reale,
 * produca il vincolo giusto.
 *
 * Da eseguire su un provider diverso cambiando AI_PROVIDER:
 *   AI_PROVIDER=deepseek npx vitest run lib/ai/estrazione.integration
 */

import { beforeEach, describe, expect, it } from "vitest"
import { estraiVincoli, type ContestoEstrazione } from "./estrazione"
import { PROVIDER, providerAttivo } from "./provider"

const provider = (() => {
  try {
    return providerAttivo()
  } catch {
    return null
  }
})()
const haChiave = provider
  ? Boolean(process.env[PROVIDER[provider].variabileChiave]?.trim())
  : false

const CONTESTO: ContestoEstrazione = {
  lavoratori: [
    { id: "w1", nome: "Marco", cognome: "Rossi" },
    { id: "w2", nome: "Giulia", cognome: "Bianchi" },
    { id: "w3", nome: "Luca", cognome: "Ferrari" },
    { id: "w4", nome: "Chiara", cognome: "Colombo" },
  ],
  postazioni: [
    { id: "p1", nome: "Reparto A" },
    { id: "p2", nome: "Centrale" },
  ],
  turni: [
    { id: "t1", codice: "M", nome: "Mattino" },
    { id: "t2", codice: "P", nome: "Pomeriggio" },
    { id: "t3", codice: "N", nome: "Notte" },
  ],
  mese: "2026-08-01",
  oggi: "2026-07-28",
}

describe.skipIf(!haChiave)(`estrazione reale via ${provider}`, () => {
  // I piani gratuiti tollerano circa una richiesta al secondo: senza pausa la
  // suite si autoinfligge dei 429 e sembra che il modello sbagli le risposte.
  beforeEach(async () => {
    await new Promise((r) => setTimeout(r, 3000))
  })

  it("«Marco Rossi ha bisogno della domenica pomeriggio libera»", async () => {
    const e = await estraiVincoli(
      "Marco Rossi ha bisogno della domenica pomeriggio libera",
      CONTESTO,
    )
    expect(e.proposte).toHaveLength(1)
    const p = e.proposte[0]
    expect(p.kind).toBe("indisponibile")
    expect(p.params.lavoratore).toBe("w1")
    expect(p.params.giorni).toEqual([0]) // 0 = domenica
    expect(p.params.turni).toEqual(["P"])
    expect(p.problemi).toEqual([])
  })

  it("«Giulia Bianchi non fa mai il turno di notte» -> obbligo assoluto", async () => {
    const e = await estraiVincoli(
      "Giulia Bianchi non fa mai il turno di notte",
      CONTESTO,
    )
    const p = e.proposte[0]
    expect(["turno_vietato", "indisponibile"]).toContain(p.kind)
    expect(p.params.lavoratore).toBe("w2")
    expect(p.params.turni).toEqual(["N"])
    expect(p.is_hard).toBe(true)
  })

  it("«Luca Ferrari preferirebbe non più di 3 notti al mese» -> preferenza", async () => {
    const e = await estraiVincoli(
      "Luca Ferrari preferirebbe non fare più di 3 notti al mese",
      CONTESTO,
    )
    const p = e.proposte[0]
    expect(p.kind).toBe("max_turni")
    expect(p.params.lavoratore).toBe("w3")
    expect(p.params.n).toBe(3)
    // "preferirebbe" non è un obbligo: se il modello lo tratta come tale,
    // il solver rinuncerebbe a coprire una notte pur di rispettarlo.
    expect(p.is_hard).toBe(false)
  })

  it("estrae più vincoli da una frase composta", async () => {
    const e = await estraiVincoli(
      "Chiara Colombo è in ferie dal 10 al 20 agosto e non fa mai le notti",
      CONTESTO,
    )
    expect(e.proposte.length).toBeGreaterThanOrEqual(2)
    for (const p of e.proposte) expect(p.params.lavoratore).toBe("w4")
  })

  it("chiede chiarimenti invece di indovinare su un nome sconosciuto", async () => {
    const e = await estraiVincoli(
      "Alessandro Neri non può lavorare di notte",
      CONTESTO,
    )
    // O dichiara l'ambiguità, o produce una proposta segnalata come bloccata.
    const bloccate = e.proposte.filter((p) => p.problemi.length > 0)
    expect(e.serveChiarimento || bloccate.length > 0).toBe(true)
    // Non deve MAI aver assegnato il vincolo a una persona a caso.
    for (const p of e.proposte) expect(p.params.lavoratore).toBeUndefined()
  })

  it("non inventa vincoli da un testo che non ne contiene", async () => {
    const e = await estraiVincoli("Buongiorno, come va il lavoro?", CONTESTO)
    expect(e.proposte).toHaveLength(0)
  })
})
