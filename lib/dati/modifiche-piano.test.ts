import { describe, expect, it } from "vitest"

import {
  aggiornaCellaLavoratore,
  aggiornaCellaPostazione,
  aspettoCellaPiano,
  lavoratoriCellaPostazione,
  calcolaModifiche,
  codificaScelta,
  creaLegendaPiano,
  decodificaScelta,
  preparaSalvataggioModifiche,
  validaModificheIntervallo,
  validaModifichePiano,
  type AssegnazioneModificabile,
} from "./modifiche-piano"

const mattinoRepartoA: AssegnazioneModificabile = {
  workerId: "worker-1",
  data: "2026-08-03",
  shiftTypeId: "shift-m",
  positionId: "position-a",
}

describe("scelte della tabella editabile", () => {
  it("codifica e decodifica una coppia turno/postazione", () => {
    const valore = codificaScelta("shift-m", "position-a")

    expect(decodificaScelta(valore)).toEqual({
      shiftTypeId: "shift-m",
      positionId: "position-a",
    })
    expect(decodificaScelta("")).toBeNull()
  })

  it("restituisce solo le celle effettivamente modificate", () => {
    const iniziali = [mattinoRepartoA]
    const correnti = [
      { ...mattinoRepartoA, shiftTypeId: "shift-p" },
      {
        workerId: "worker-2",
        data: "2026-08-03",
        shiftTypeId: "shift-n",
        positionId: "position-a",
      },
    ]

    expect(calcolaModifiche(iniziali, correnti)).toEqual([
      { ...mattinoRepartoA, shiftTypeId: "shift-p" },
      {
        workerId: "worker-2",
        data: "2026-08-03",
        shiftTypeId: "shift-n",
        positionId: "position-a",
      },
    ])
  })

  it("rappresenta la rimozione di un turno come riposo", () => {
    expect(calcolaModifiche([mattinoRepartoA], [])).toEqual([
      {
        workerId: "worker-1",
        data: "2026-08-03",
        shiftTypeId: null,
        positionId: null,
      },
    ])
  })
})

describe("validazione delle modifiche persistenti", () => {
  it("accetta assegnazioni e riposi validi nello stesso mese", () => {
    expect(
      validaModifichePiano("2026-08-01", [
        mattinoRepartoA,
        {
          workerId: "worker-2",
          data: "2026-08-31",
          shiftTypeId: null,
          positionId: null,
        },
      ]),
    ).toEqual([
      mattinoRepartoA,
      {
        workerId: "worker-2",
        data: "2026-08-31",
        shiftTypeId: null,
        positionId: null,
      },
    ])
  })

  it("accetta modifiche su mesi diversi nello stesso intervallo", () => {
    expect(
      validaModificheIntervallo("2026-08-20", "2026-09-10", [
        { ...mattinoRepartoA, data: "2026-08-31" },
        { ...mattinoRepartoA, data: "2026-09-01" },
      ]),
    ).toHaveLength(2)
  })

  it("rifiuta celle duplicate per lavoratore e giorno", () => {
    expect(() =>
      validaModifichePiano("2026-08-01", [mattinoRepartoA, mattinoRepartoA]),
    ).toThrow("Una cella può essere modificata una sola volta")
  })

  it("rifiuta date esterne al mese pianificato", () => {
    expect(() =>
      validaModifichePiano("2026-08-01", [
        { ...mattinoRepartoA, data: "2026-09-01" },
      ]),
    ).toThrow("fuori dal mese")
  })

  it("richiede turno e postazione insieme", () => {
    expect(() =>
      validaModifichePiano("2026-08-01", [
        { ...mattinoRepartoA, positionId: null },
      ]),
    ).toThrow("Turno e postazione devono essere indicati insieme")
  })
})

describe("preparazione del salvataggio", () => {
  it("separa gli upsert manuali dai turni da rimuovere", () => {
    expect(
      preparaSalvataggioModifiche("schedule-1", [
        mattinoRepartoA,
        {
          workerId: "worker-2",
          data: "2026-08-04",
          shiftTypeId: null,
          positionId: null,
        },
      ]),
    ).toEqual({
      daSalvare: [
        {
          schedule_id: "schedule-1",
          worker_id: "worker-1",
          data: "2026-08-03",
          shift_type_id: "shift-m",
          position_id: "position-a",
          origine: "manuale",
          bloccato: true,
        },
      ],
      daRimuovere: [{ workerId: "worker-2", data: "2026-08-04" }],
    })
  })
})

describe("interazioni sulle tabelle colorate", () => {
  it("usa il colore della postazione e il codice del turno", () => {
    expect(
      aspettoCellaPiano(
        mattinoRepartoA,
        [{ id: "position-a", colore: "#2563eb" }],
        [{ id: "shift-m", codice: "M", colore: "#111111" }],
      ),
    ).toEqual({ colore: "#2563eb", codice: "M" })
  })

  it("ricostruisce la legenda dai nomi e dagli orari correnti", () => {
    const legenda = creaLegendaPiano(
      [{ id: "position-a", nome: "Terapia intensiva", colore: "#2563eb" }],
      [
        {
          id: "shift-m",
          codice: "M",
          nome: "Mattino lungo",
          ora_inizio: "06:30:00",
          ora_fine: "14:30:00",
          durata_min: 480,
        },
      ],
    )

    expect(legenda.postazioni[0]).toEqual({
      id: "position-a",
      nome: "Terapia intensiva",
      colore: "#2563eb",
    })
    expect(legenda.turni[0]).toMatchObject({
      codice: "M",
      nome: "Mattino lungo",
      oraInizio: "06:30",
      oraFine: "14:30",
      durataMin: 480,
    })
  })

  it("propaga una modifica per lavoratore nella proiezione per postazione", () => {
    const correnti = aggiornaCellaLavoratore(
      [mattinoRepartoA],
      "worker-1",
      "2026-08-03",
      { shiftTypeId: "shift-p", positionId: "position-b" },
    )

    expect(
      lavoratoriCellaPostazione(
        correnti,
        "position-b",
        "shift-p",
        "2026-08-03",
      ),
    ).toEqual(["worker-1"])
    expect(
      lavoratoriCellaPostazione(
        correnti,
        "position-a",
        "shift-m",
        "2026-08-03",
      ),
    ).toEqual([])
  })

  it("sostituisce o rimuove il turno cliccato nella vista per lavoratore", () => {
    const sostituita = aggiornaCellaLavoratore(
      [mattinoRepartoA],
      "worker-1",
      "2026-08-03",
      { shiftTypeId: "shift-p", positionId: "position-b" },
    )

    expect(sostituita).toEqual([
      {
        workerId: "worker-1",
        data: "2026-08-03",
        shiftTypeId: "shift-p",
        positionId: "position-b",
      },
    ])
    expect(
      aggiornaCellaLavoratore(sostituita, "worker-1", "2026-08-03", null),
    ).toEqual([])
  })

  it("aggiorna gli assegnati della cella per postazione senza toccare le altre date", () => {
    const correnti: AssegnazioneModificabile[] = [
      mattinoRepartoA,
      {
        workerId: "worker-2",
        data: "2026-08-03",
        shiftTypeId: "shift-p",
        positionId: "position-b",
      },
      {
        workerId: "worker-3",
        data: "2026-08-04",
        shiftTypeId: "shift-n",
        positionId: "position-a",
      },
    ]

    expect(
      aggiornaCellaPostazione(
        correnti,
        {
          data: "2026-08-03",
          shiftTypeId: "shift-p",
          positionId: "position-b",
        },
        ["worker-1"],
      ),
    ).toEqual([
      {
        workerId: "worker-3",
        data: "2026-08-04",
        shiftTypeId: "shift-n",
        positionId: "position-a",
      },
      {
        workerId: "worker-1",
        data: "2026-08-03",
        shiftTypeId: "shift-p",
        positionId: "position-b",
      },
    ])
  })
})
