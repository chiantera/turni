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

export interface ContestoSuggerimentiPiano {
  dal: string
  al: string
  segnalazioni: {
    gravita: string
    tipo: string
    messaggio: string
    data: string | null
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

export function costruisciPromptSuggerimenti(
  contesto: ContestoSuggerimentiPiano,
): string {
  return `Sei un consulente esperto di pianificazione dei turni di lavoro.
Analizza un piano che il solver non è riuscito a completare senza segnalazioni.

OBIETTIVO
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
