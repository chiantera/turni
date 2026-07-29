import { z } from "zod"

export const PERCORSI_SUGGERITI = [
  "/copertura",
  "/lavoratori",
  "/vincoli",
  "/impostazioni",
  "/pianificazione",
] as const

export const SchemaSuggerimentiPiano = z.object({
  diagnosi: z.string().min(1).max(800),
  suggerimenti: z
    .array(
      z.object({
        priorita: z.enum(["alta", "media", "bassa"]),
        titolo: z.string().min(1).max(120),
        spiegazione: z.string().min(1).max(600),
        azioni: z.array(z.string().min(1).max(220)).min(1).max(5),
        percorso: z.enum(PERCORSI_SUGGERITI).nullable(),
      }),
    )
    .min(1)
    .max(5),
  limiti: z.string().min(1).max(500),
})

export type SuggerimentiPiano = z.infer<typeof SchemaSuggerimentiPiano>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function segnalazioneIdDaCorpo(corpo: unknown): string | null {
  if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) return null
  if (!("segnalazioneId" in corpo)) return null
  const valore = (corpo as { segnalazioneId?: unknown }).segnalazioneId
  if (typeof valore !== "string" || !UUID.test(valore)) {
    throw new Error("Segnalazione non valida.")
  }
  return valore
}

export interface ContestoSuggerimentiPiano {
  dal: string
  al: string
  segnalazioni: {
    gravita: string
    tipo: string
    messaggio: string
    data: string | null
    riferimenti?: Record<string, unknown>
  }[]
  lavoratori: {
    nome: string
    oreSettimanali: number
    postazioni: string[]
  }[]
  turni: { codice: string; nome: string }[]
  copertura: {
    postazione: string
    turno: string
    giornoSettimana: number | null
    tipoGiorno: string
    richiesti: number
  }[]
  assenze: number
  vincoli: string[]
}

function riferimentoTestuale(
  riferimenti: Record<string, unknown> | undefined,
  chiave: string,
) {
  const valore = riferimenti?.[chiave]
  return typeof valore === "string" ? valore.toLocaleLowerCase("it") : null
}

export function riduciContestoAllaSegnalazione(
  contesto: ContestoSuggerimentiPiano,
  segnalazione: ContestoSuggerimentiPiano["segnalazioni"][number],
): ContestoSuggerimentiPiano {
  const testo = segnalazione.messaggio.toLocaleLowerCase("it")
  const postazioneRiferita = riferimentoTestuale(
    segnalazione.riferimenti,
    "postazione",
  )
  const turnoRiferito = riferimentoTestuale(segnalazione.riferimenti, "turno")
  const postazioniPertinenti = new Set(
    contesto.copertura
      .map((c) => c.postazione)
      .filter(
        (nome) =>
          nome.toLocaleLowerCase("it") === postazioneRiferita ||
          testo.includes(nome.toLocaleLowerCase("it")),
      ),
  )
  const lavoratori = contesto.lavoratori.filter(
    (lavoratore) =>
      testo.includes(lavoratore.nome.toLocaleLowerCase("it")) ||
      lavoratore.postazioni.some((postazione) =>
        postazioniPertinenti.has(postazione),
      ),
  )
  const turni = contesto.turni.filter((turno) => {
    const codice = turno.codice.toLocaleLowerCase("it")
    const nome = turno.nome.toLocaleLowerCase("it")
    return turnoRiferito
      ? turnoRiferito === codice || turnoRiferito === nome
      : testo.includes(nome)
  })
  const codiciTurno = new Set(turni.map((turno) => turno.codice))
  const copertura = contesto.copertura.filter(
    (riga) =>
      postazioniPertinenti.has(riga.postazione) &&
      (codiciTurno.size === 0 || codiciTurno.has(riga.turno)),
  )
  const nomiLavoratori = lavoratori.map((lavoratore) =>
    lavoratore.nome.toLocaleLowerCase("it"),
  )
  const vincoli = contesto.vincoli.filter((vincolo) => {
    const testoVincolo = vincolo.toLocaleLowerCase("it")
    return nomiLavoratori.some((nome) => testoVincolo.includes(nome))
  })

  return {
    ...contesto,
    segnalazioni: [segnalazione],
    lavoratori,
    turni,
    copertura,
    vincoli,
  }
}

export function costruisciPromptSuggerimenti(
  contesto: ContestoSuggerimentiPiano,
): string {
  const obiettivo =
    contesto.segnalazioni.length === 1
      ? "SINGOLA SEGNALAZIONE: analizza esclusivamente il problema indicato e proponi interventi mirati."
      : "ANALISI COMPLETA: considera insieme tutte le segnalazioni del piano."
  return `Sei un consulente esperto di pianificazione dei turni di lavoro.
Analizza un piano che il solver non è riuscito a completare senza segnalazioni.

OBIETTIVO
${obiettivo}
Proponi interventi concreti e verificabili che un pianificatore può valutare.
Distingui la causa probabile dalle ipotesi. NON modificare dati e non presentare
alcun suggerimento come applicato. Non inventare lavoratori, turni, postazioni,
assenze o vincoli. Se i dati non bastano, dichiaralo. Devi sempre ricordare che
occorre rieseguire il solver: non garantire che una proposta risolva il piano.

DATI REALI DEL PIANO
${JSON.stringify(contesto, null, 2)}

AREE DELL'APPLICAZIONE
- /copertura: quantità richieste per postazione e turno
- /lavoratori: organico, ore e abilitazioni
- /vincoli: obblighi e preferenze
- /impostazioni: regole generali e pesi
- /pianificazione: correzioni manuali e nuova generazione

FORMATO
Rispondi esclusivamente con JSON:
{
  "diagnosi": "sintesi fondata sulle segnalazioni",
  "suggerimenti": [{
    "priorita": "alta|media|bassa",
    "titolo": "azione sintetica",
    "spiegazione": "perché può aiutare, citando i dati pertinenti",
    "azioni": ["passo concreto 1", "passo concreto 2"],
    "percorso": "/copertura|/lavoratori|/vincoli|/impostazioni|/pianificazione|null"
  }],
  "limiti": "cosa resta da verificare rieseguendo il solver"
}`
}
