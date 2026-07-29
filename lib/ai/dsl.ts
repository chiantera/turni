/**
 * DSL dei vincoli: l'insieme CHIUSO di cose che l'AI può proporre.
 *
 * Questo è il confine di sicurezza del sistema. Il modello non genera turni,
 * non scrive SQL e non produce logica: può soltanto restituire oggetti che
 * combaciano con questi schemi. Tutto ciò che non combacia viene rifiutato
 * prima ancora di arrivare all'utente.
 *
 * Lo stesso schema `zod` serve tre scopi, e questo è deliberato:
 *   1. istruisce il modello (l'SDK ne ricava il JSON Schema)
 *   2. valida la risposta a runtime
 *   3. tipizza il codice TypeScript
 * Tenerli allineati a mano sarebbe una fonte garantita di bug silenziosi.
 */

import { z } from "zod"

export const KIND_VINCOLO = [
  "indisponibile",
  "preferenza",
  "turno_vietato",
  "postazione_fissa",
  "insieme",
  "separati",
  "max_turni",
  "min_turni",
  "ore_override",
  "copertura_override",
  "assegnazione_fissa",
] as const

export const GIORNI_NOME = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
] as const

/**
 * Struttura piatta anziché unione discriminata: le unioni complesse in JSON
 * Schema mettono in difficoltà diversi provider, che rispondono con oggetti
 * mal formati o si rifiutano di generare. Un oggetto piatto con campi
 * opzionali è comprensibile a tutti; la coerenza fra `kind` e campi la
 * verifichiamo noi subito dopo.
 */
export const SchemaVincolo = z.object({
  kind: z.enum(KIND_VINCOLO).describe("Tipo di vincolo"),

  descrizione: z
    .string()
    .describe(
      "Riformulazione in italiano semplice e verificabile, che verrà mostrata all'utente per la conferma",
    ),

  is_hard: z
    .boolean()
    .describe(
      "true = obbligo assoluto (es. 'non può assolutamente'); false = preferenza da rispettare se possibile",
    ),

  lavoratore: z
    .string()
    .nullable()
    .describe("Nome del lavoratore esattamente come compare nell'elenco fornito"),

  lavoratori: z
    .array(z.string())
    .nullable()
    .describe("Due nomi, solo per i vincoli 'insieme' e 'separati'"),

  giorni: z
    .array(z.number().int().min(0).max(6))
    .nullable()
    .describe("Giorni della settimana ricorrenti: 0=domenica, 1=lunedì ... 6=sabato"),

  date: z
    .array(z.string())
    .nullable()
    .describe("Date specifiche in formato AAAA-MM-GG, per eventi non ricorrenti"),

  turni: z
    .array(z.string())
    .nullable()
    .describe("Codici dei turni interessati, dall'elenco fornito (es. M, P, N). Vuoto o null = tutti"),

  postazioni: z
    .array(z.string())
    .nullable()
    .describe("Nomi delle postazioni interessate, dall'elenco fornito"),

  n: z
    .number()
    .int()
    .nullable()
    .describe("Quantità, per max_turni / min_turni / copertura_override"),

  ore_settimana: z
    .number()
    .nullable()
    .describe("Nuovo monte ore settimanale, solo per ore_override"),

  valido_dal: z.string().nullable().describe("Inizio validità AAAA-MM-GG, null = sempre"),
  valido_al: z.string().nullable().describe("Fine validità AAAA-MM-GG, null = sempre"),
})

export type VincoloEstratto = z.infer<typeof SchemaVincolo>

export const SchemaEstrazione = z.object({
  vincoli: z
    .array(SchemaVincolo)
    .describe("I vincoli ricavati dal testo. Vuoto se il testo non ne contiene."),
  riepilogo: z
    .string()
    .describe("Una frase in italiano che riassume cosa è stato capito"),
  serve_chiarimento: z
    .boolean()
    .describe("true se il testo è ambiguo e non si può decidere senza chiedere"),
  domanda: z
    .string()
    .nullable()
    .describe("La domanda da porre all'utente, se serve_chiarimento è true"),
})

export type Estrazione = z.infer<typeof SchemaEstrazione>

/**
 * Lo schema come testo, da includere nel prompt di sistema.
 *
 * Perché serve, dato che lo schema viene già passato all'SDK: parecchi
 * modelli — fra cui i GLM Flash del piano gratuito — ACCETTANO
 * `response_format: {type:"json_schema"}` senza protestare e poi lo IGNORANO,
 * rispondendo in prosa o inventando una struttura propria. Ripetere lo schema
 * nel prompt è l'unico modo che funziona ovunque.
 *
 * Generato da zod anziché scritto a mano, così non può divergere dallo schema
 * con cui la risposta viene poi validata.
 */
export function schemaComeTesto(): string {
  return JSON.stringify(z.toJSONSchema(SchemaEstrazione), null, 1)
}

/** Esempio completo: mostrare vale più che descrivere. */
export const ESEMPIO_RISPOSTA = {
  vincoli: [
    {
      kind: "indisponibile",
      descrizione: "Mario Bianchi non lavora la domenica pomeriggio",
      is_hard: true,
      lavoratore: "Mario Bianchi",
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
  riepilogo: "Mario Bianchi ha chiesto libera la domenica pomeriggio.",
  serve_chiarimento: false,
  domanda: null,
}

// ---------------------------------------------------------------------------
// Validazione di coerenza
// ---------------------------------------------------------------------------

/**
 * Verifica che i campi presenti abbiano senso per il `kind` dichiarato.
 * Un modello può produrre JSON formalmente valido ma semanticamente vuoto —
 * per esempio un `max_turni` senza `n`. Meglio scartarlo subito che scoprirlo
 * quando il solver ignora silenziosamente il vincolo.
 */
export function problemiDiCoerenza(v: VincoloEstratto): string[] {
  const p: string[] = []
  const serveLavoratore = [
    "indisponibile",
    "preferenza",
    "turno_vietato",
    "postazione_fissa",
    "max_turni",
    "min_turni",
    "ore_override",
    "assegnazione_fissa",
  ]

  if (serveLavoratore.includes(v.kind) && !v.lavoratore) {
    p.push("manca il lavoratore")
  }
  if ((v.kind === "insieme" || v.kind === "separati") && (v.lavoratori?.length ?? 0) !== 2) {
    p.push("servono esattamente due lavoratori")
  }
  if ((v.kind === "max_turni" || v.kind === "min_turni") && v.n === null) {
    p.push("manca il numero di turni")
  }
  if (v.kind === "ore_override" && v.ore_settimana === null) {
    p.push("mancano le ore settimanali")
  }
  if (v.kind === "postazione_fissa" && (v.postazioni?.length ?? 0) === 0) {
    p.push("manca la postazione")
  }
  if (v.kind === "copertura_override" && (v.n === null || (v.postazioni?.length ?? 0) === 0)) {
    p.push("servono postazione e quantità")
  }
  if (
    v.kind === "assegnazione_fissa" &&
    ((v.date?.length ?? 0) === 0 || (v.turni?.length ?? 0) === 0)
  ) {
    p.push("servono data e turno")
  }
  if (
    v.kind === "indisponibile" &&
    (v.giorni?.length ?? 0) === 0 &&
    (v.date?.length ?? 0) === 0
  ) {
    p.push("serve almeno un giorno o una data")
  }

  for (const d of v.date ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) p.push(`data non valida: "${d}"`)
  }
  return p
}

// ---------------------------------------------------------------------------
// Risoluzione dei nomi
// ---------------------------------------------------------------------------

function normalizza(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // toglie i segni diacritici scomposti da NFD
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Distanza di Damerau-Levenshtein (allineamento ottimale di stringhe).
 *
 * Conta lo scambio di due lettere adiacenti come UN errore, non due. È la
 * differenza che conta nella pratica: "Guilia" per "Giulia" è l'errore di
 * battitura più frequente e con Levenshtein semplice verrebbe penalizzato il
 * doppio di quanto merita, facendo fallire il riconoscimento.
 */
function distanza(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // cancellazione
        d[i][j - 1] + 1, // inserimento
        d[i - 1][j - 1] + costo, // sostituzione
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1) // trasposizione
      }
    }
  }
  return d[m][n]
}

export interface Candidato {
  id: string
  etichetta: string
}

export interface EsitoRisoluzione {
  id: string | null
  etichetta: string | null
  /** 1 = corrispondenza esatta; sotto 0.6 è meglio chiedere conferma. */
  confidenza: number
  alternative: Candidato[]
}

/**
 * Associa un nome scritto liberamente a un record reale.
 *
 * L'utente scrive "Mario", "il Rossi", "worker a"; il modello restituisce quel
 * che ha letto. Sbagliare persona qui significa mandare in ferie la persona
 * sbagliata, quindi sotto una certa confidenza non si indovina: si chiede.
 */
export function risolviNome(grezzo: string, candidati: Candidato[]): EsitoRisoluzione {
  const vuoto: EsitoRisoluzione = {
    id: null,
    etichetta: null,
    confidenza: 0,
    alternative: candidati.slice(0, 5),
  }
  if (!grezzo?.trim() || candidati.length === 0) return vuoto

  const q = normalizza(grezzo)

  const punteggi = candidati.map((c) => {
    const e = normalizza(c.etichetta)
    if (e === q) return { c, punti: 1 }

    // Corrispondenza su una parola intera (nome o cognome da solo)
    const parole = e.split(" ")
    if (parole.includes(q)) return { c, punti: 0.9 }
    if (e.startsWith(q) || e.endsWith(q)) return { c, punti: 0.8 }
    if (e.includes(q)) return { c, punti: 0.7 }

    // Il fattore 0.75 tiene le corrispondenze approssimate sotto quelle
    // testuali: un refuso può essere accettato, un nome diverso no.
    const d = distanza(q, e)
    const sim = 1 - d / Math.max(q.length, e.length)
    return { c, punti: sim * 0.75 }
  })

  punteggi.sort((a, b) => b.punti - a.punti)
  const migliore = punteggi[0]
  const secondo = punteggi[1]

  // Due candidati ugualmente plausibili: è ambiguo, non si tira a indovinare.
  if (secondo && migliore.punti - secondo.punti < 0.05 && migliore.punti < 1) {
    return {
      id: null,
      etichetta: null,
      confidenza: migliore.punti / 2,
      alternative: punteggi.slice(0, 5).map((p) => p.c),
    }
  }

  return {
    id: migliore.punti >= 0.6 ? migliore.c.id : null,
    etichetta: migliore.punti >= 0.6 ? migliore.c.etichetta : null,
    confidenza: migliore.punti,
    alternative: punteggi.slice(0, 5).map((p) => p.c),
  }
}
