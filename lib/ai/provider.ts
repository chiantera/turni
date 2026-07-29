/**
 * Registro dei provider AI.
 *
 * Tutto il codice AI dell'applicazione passa da `ottieniModello()`. Cambiare
 * modello significa cambiare una variabile d'ambiente: nessuna modifica al
 * codice, nessun ramo `if (provider === ...)` sparso in giro.
 *
 * Chi espone un'API compatibile con OpenAI (GLM, Kimi, endpoint self-hosted)
 * passa dall'adattatore generico; chi ha un pacchetto dedicato lo usa, perché
 * gestisce meglio le peculiarità del proprio protocollo.
 *
 * L'output strutturato non richiede configurazione per provider: dalla
 * versione 7 l'SDK negozia da sé il formato migliore (schema JSON nativo dove
 * c'è, function calling altrimenti) e riprova se la risposta non valida.
 *
 * IMPORTANTE: questo modulo è SOLO lato server. Le chiavi non devono mai
 * finire nel bundle del browser, perciò nessuna variabile qui è NEXT_PUBLIC_.
 */

import { createAnthropic } from "@ai-sdk/anthropic"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createMistral } from "@ai-sdk/mistral"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"

import "server-only"

export type NomeProvider =
  | "glm"
  | "deepseek"
  | "mistral"
  | "kimi"
  | "anthropic"
  | "openai"
  | "custom"

export interface DefinizioneProvider {
  nome: string
  etichetta: string
  modelloDefault: string
  variabileChiave: string
  baseUrl?: string
  /** Modelli suggeriti nel selettore delle impostazioni. */
  modelliNoti: string[]
  /**
   * Campi aggiuntivi da iniettare nel corpo della richiesta, per parametri
   * proprietari che l'adattatore OpenAI-compatibile non conosce.
   */
  corpoExtra?: Record<string, unknown>
  /**
   * true se l'endpoint accetta `response_format: {type: "json_schema", ...}`.
   *
   * Senza questo l'adattatore ripiega su `{type: "json_object"}`, che chiede
   * "un JSON qualsiasi" SENZA allegare lo schema: il modello non ha modo di
   * sapere quale forma produrre e se ne inventa una propria. È un fallimento
   * silenzioso e molto ingannevole, perché la risposta è JSON valido — solo
   * con i campi sbagliati.
   */
  schemaNativo?: boolean
  /** Spiegazione mostrata in /impostazioni. */
  nota?: string
}

export const PROVIDER: Record<NomeProvider, DefinizioneProvider> = {
  glm: {
    nome: "glm",
    etichetta: "GLM (Z.ai / Zhipu)",
    // I modelli "-flash" sono gli unici del piano gratuito. Gli altri
    // (glm-4.6, glm-4.7, glm-5.x) rispondono 429 codice 1113 "insufficient
    // balance" se l'account non ha credito, il che è facile scambiare per un
    // problema di chiave: la chiave è valida, è il modello a essere a pagamento.
    // Fra i due Flash gratuiti, il 4.7 è nettamente più affidabile
    // sull'output strutturato: sulla stessa suite fa 6/6 in ~5s per richiesta,
    // mentre il 4.5 fallisce di tanto in tanto e arriva a impiegarci 60s.
    modelloDefault: "glm-4.7-flash",
    variabileChiave: "GLM_API_KEY",
    baseUrl: "https://api.z.ai/api/paas/v4",
    modelliNoti: [
      "glm-4.7-flash",
      "glm-4.5-flash",
      "glm-4.6",
      "glm-4.7",
      "glm-5.2",
    ],
    // I Flash sono modelli di RAGIONAMENTO: se lasciati liberi scrivono la
    // catena di pensiero in `reasoning_content` (1800+ caratteri anche per una
    // frase banale) e restituiscono `content` vuoto quando il budget di token
    // finisce prima. Il risultato è un NoObjectGeneratedError che sembra un
    // difetto dello schema mentre è solo il modello che non ha smesso di
    // pensare. Per tradurre una frase in un vincolo il ragionamento non serve.
    corpoExtra: { thinking: { type: "disabled" } },
    // Verificato sul campo: i Flash ACCETTANO `response_format: json_schema`
    // senza errore ma lo IGNORANO, rispondendo in prosa. Meglio dichiararlo
    // non supportato e mettere lo schema nel prompt, dove viene rispettato.
    schemaNativo: false,
    nota:
      "Piano gratuito: solo i modelli -flash (gli altri richiedono credito). " +
      "Il ragionamento viene disattivato automaticamente, altrimenti consuma " +
      "i token senza produrre risposta.",
  },
  deepseek: {
    nome: "deepseek",
    etichetta: "DeepSeek",
    modelloDefault: "deepseek-chat",
    variabileChiave: "DEEPSEEK_API_KEY",
    modelliNoti: ["deepseek-chat", "deepseek-reasoner"],
  },
  mistral: {
    nome: "mistral",
    etichetta: "Mistral",
    modelloDefault: "mistral-large-latest",
    variabileChiave: "MISTRAL_API_KEY",
    modelliNoti: ["mistral-large-latest", "mistral-small-latest"],
  },
  kimi: {
    nome: "kimi",
    etichetta: "Kimi (Moonshot)",
    modelloDefault: "kimi-k2",
    variabileChiave: "MOONSHOT_API_KEY",
    baseUrl: "https://api.moonshot.ai/v1",
    modelliNoti: ["kimi-k2", "moonshot-v1-32k"],
  },

  anthropic: {
    nome: "anthropic",
    etichetta: "Anthropic (Claude)",
    modelloDefault: "claude-sonnet-5",
    variabileChiave: "ANTHROPIC_API_KEY",
    modelliNoti: ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5-20251001"],
  },
  openai: {
    nome: "openai",
    etichetta: "OpenAI",
    modelloDefault: "gpt-5",
    variabileChiave: "OPENAI_API_KEY",
    modelliNoti: ["gpt-5", "gpt-5-mini"],
  },
  custom: {
    nome: "custom",
    etichetta: "Endpoint personalizzato (OpenAI-compatibile)",
    modelloDefault: "",
    variabileChiave: "AI_API_KEY",
    modelliNoti: [],
  },
}

export class ErroreConfigurazioneAI extends Error {
  constructor(messaggio: string) {
    super(messaggio)
    this.name = "ErroreConfigurazioneAI"
  }
}

export interface ModelloRisolto {
  modello: LanguageModel
  provider: NomeProvider
  nomeModello: string
}

export interface OpzioniModello {
  /** Sovrascrive AI_PROVIDER (es. scelta fatta dalle impostazioni). */
  provider?: string | null
  /** Sovrascrive AI_MODEL. */
  modello?: string | null
}

export function providerAttivo(opz: OpzioniModello = {}): NomeProvider {
  const grezzo = (opz.provider ?? process.env.AI_PROVIDER ?? "glm").toLowerCase()
  if (!(grezzo in PROVIDER)) {
    throw new ErroreConfigurazioneAI(
      `Provider AI sconosciuto: "${grezzo}". Valori ammessi: ${Object.keys(PROVIDER).join(", ")}.`,
    )
  }
  return grezzo as NomeProvider
}

/** true se la chiave del provider è presente nell'ambiente. */
export function provisto(nome: NomeProvider): boolean {
  return Boolean(process.env[PROVIDER[nome].variabileChiave]?.trim())
}

/** Elenco per il selettore in /impostazioni, con lo stato di ciascuno. */
export function statoProvider() {
  return (Object.keys(PROVIDER) as NomeProvider[]).map((n) => ({
    nome: n,
    etichetta: PROVIDER[n].etichetta,
    modelloDefault: PROVIDER[n].modelloDefault,
    modelliNoti: PROVIDER[n].modelliNoti,
    nota: PROVIDER[n].nota ?? null,
    configurato: provisto(n),
  }))
}

/**
 * Middleware su fetch che aggiunge campi al corpo della richiesta.
 *
 * L'adattatore OpenAI-compatibile accetta solo i parametri standard, ma alcuni
 * provider ne richiedono di proprietari (GLM: `thinking`). Intercettare la
 * richiesta è l'unico punto in cui si possono aggiungere senza rinunciare
 * all'adattatore o duplicarne la logica.
 */
function fetchConCorpoExtra(extra: Record<string, unknown>): typeof fetch {
  return async (input, init) => {
    if (init?.body && typeof init.body === "string") {
      try {
        const corpo = JSON.parse(init.body)
        init = { ...init, body: JSON.stringify({ ...corpo, ...extra }) }
      } catch {
        // Corpo non JSON (raro): lo lascio passare intatto.
      }
    }
    return tracciaSeRichiesto(input, init)
  }
}

/**
 * Con AI_DEBUG=1 stampa richiesta e risposta grezze.
 *
 * Serve perché i fallimenti dell'output strutturato sono opachi: l'SDK riporta
 * solo "nessun oggetto generato", mentre la causa sta nel corpo della risposta
 * (contenuto vuoto, catena di pensiero al posto del JSON, testo racchiuso in
 * un blocco markdown). Senza vedere quel corpo si tira a indovinare.
 */
async function tracciaSeRichiesto(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
): Promise<Response> {
  if (process.env.AI_DEBUG !== "1") return fetch(input, init)

  console.error("\n===== RICHIESTA =====")
  console.error(String(init?.body).slice(0, 2500))

  const risposta = await fetch(input, init)
  const testo = await risposta.clone().text()
  console.error("===== RISPOSTA =====")
  console.error(risposta.status, testo.slice(0, 2500))
  return risposta
}

export function ottieniModello(opz: OpzioniModello = {}): ModelloRisolto {
  const nome = providerAttivo(opz)
  const def = PROVIDER[nome]
  const chiave = process.env[def.variabileChiave]?.trim()

  if (!chiave) {
    throw new ErroreConfigurazioneAI(
      `Manca la chiave API per ${def.etichetta}: imposta ${def.variabileChiave} in .env.local.`,
    )
  }

  const nomeModello =
    opz.modello?.trim() || process.env.AI_MODEL?.trim() || def.modelloDefault

  if (!nomeModello) {
    throw new ErroreConfigurazioneAI(
      `Nessun modello indicato per ${def.etichetta}: imposta AI_MODEL in .env.local.`,
    )
  }

  let modello: LanguageModel

  switch (nome) {
    case "anthropic":
      modello = createAnthropic({ apiKey: chiave })(nomeModello)
      break
    case "openai":
      modello = createOpenAI({ apiKey: chiave })(nomeModello)
      break
    case "mistral":
      modello = createMistral({ apiKey: chiave })(nomeModello)
      break
    case "deepseek":
      modello = createDeepSeek({ apiKey: chiave })(nomeModello)
      break
    case "custom": {
      const baseURL = process.env.AI_BASE_URL?.trim()
      if (!baseURL) {
        throw new ErroreConfigurazioneAI(
          "Con AI_PROVIDER=custom serve anche AI_BASE_URL.",
        )
      }
      modello = createOpenAICompatible({ name: "custom", baseURL, apiKey: chiave })(
        nomeModello,
      )
      break
    }
    default: {
      // GLM e Kimi: API compatibile con OpenAI, cambia solo l'endpoint.
      modello = createOpenAICompatible({
        name: nome,
        baseURL: def.baseUrl!,
        apiKey: chiave,
        supportsStructuredOutputs: def.schemaNativo ?? false,
        ...(def.corpoExtra ? { fetch: fetchConCorpoExtra(def.corpoExtra) } : {}),
      })(nomeModello)
      break
    }
  }

  return { modello, provider: nome, nomeModello }
}
