import { describe, expect, it } from "vitest"

import {
  passoSuccessivo,
  primiPassi,
  type StatoConfigurazione,
} from "./primi-passi"

const VUOTO: StatoConfigurazione = {
  lavoratoriAttivi: 0,
  lavoratoriSenzaAbilitazione: 0,
  postazioniAttive: 0,
  turniAttivi: 0,
  regoleCoperturaRichieste: 0,
  pianiGenerati: 0,
}

const COMPLETO: StatoConfigurazione = {
  lavoratoriAttivi: 29,
  lavoratoriSenzaAbilitazione: 0,
  postazioniAttive: 2,
  turniAttivi: 16,
  regoleCoperturaRichieste: 86,
  pianiGenerati: 3,
}

function passo(stato: StatoConfigurazione, id: string) {
  const trovato = primiPassi(stato).find((p) => p.id === id)
  if (!trovato) throw new Error(`passo ${id} inesistente`)
  return trovato
}

describe("primi passi", () => {
  it("su un'installazione vuota non dà niente per fatto", () => {
    expect(primiPassi(VUOTO).every((p) => !p.fatto)).toBe(true)
  })

  it("su una configurazione completa non lascia nulla da fare", () => {
    expect(primiPassi(COMPLETO).every((p) => p.fatto)).toBe(true)
    expect(passoSuccessivo(primiPassi(COMPLETO))).toBeNull()
  })

  it("indica come prossimo passo il primo mancante, non l'ultimo", () => {
    const stato = { ...COMPLETO, pianiGenerati: 0, regoleCoperturaRichieste: 0 }
    expect(passoSuccessivo(primiPassi(stato))?.id).toBe("copertura")
  })

  it("considera la struttura incompleta se mancano i turni, non solo le postazioni", () => {
    expect(passo({ ...COMPLETO, turniAttivi: 0 }, "struttura").fatto).toBe(false)
    expect(passo({ ...COMPLETO, postazioniAttive: 0 }, "struttura").fatto).toBe(false)
  })

  it("segnala i lavoratori senza abilitazione, che il solver non assegna mai", () => {
    const p = passo({ ...COMPLETO, lavoratoriSenzaAbilitazione: 3 }, "abilitazioni")
    expect(p.fatto).toBe(false)
    expect(p.dettaglio).toContain("3 lavoratori")
  })

  it("non dichiara fatte le abilitazioni quando non esiste alcun lavoratore", () => {
    // Zero su zero e' vacuamente vero e sarebbe la risposta sbagliata: senza
    // lavoratori il passo non e' compiuto, e' solo non ancora iniziato.
    expect(passo(VUOTO, "abilitazioni").fatto).toBe(false)
  })

  it("non conta come copertura le regole a zero richiesti", () => {
    // Il Bruco ha due righe festive a `n_richiesti = 0` perche' chiude: sono
    // configurazione valida, non fabbisogno. La query le esclude a monte.
    expect(passo({ ...VUOTO, regoleCoperturaRichieste: 0 }, "copertura").fatto).toBe(
      false,
    )
  })

  it("accorda i conteggi al singolare", () => {
    expect(passo({ ...COMPLETO, lavoratoriAttivi: 1 }, "lavoratori").dettaglio).toBe(
      "1 lavoratore attivo.",
    )
    expect(passo(COMPLETO, "lavoratori").dettaglio).toBe("29 lavoratori attivi.")
  })

  it("porta ogni passo a una pagina raggiungibile dal menu", () => {
    const percorsi = primiPassi(VUOTO).map((p) => p.href)
    expect(percorsi).toEqual([
      "/lavoratori",
      "/postazioni",
      "/lavoratori",
      "/copertura",
      "/pianificazione",
    ])
  })
})
