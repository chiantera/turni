import { generateObject } from "ai"

import { eDefinitivo, traduciErrore } from "./errori"
import { ottieniModello, type OpzioniModello } from "./provider"
import {
  costruisciPromptSuggerimenti,
  SchemaSuggerimentiPiano,
  type ContestoSuggerimentiPiano,
  type SuggerimentiPiano,
} from "./suggerimenti-piano"

export interface EsitoSuggerimentiPiano extends SuggerimentiPiano {
  provider: string
  modello: string
  latenzaMs: number
  tokenInput?: number
  tokenOutput?: number
}

export async function generaSuggerimentiPiano(
  contesto: ContestoSuggerimentiPiano,
  opzioni: OpzioniModello = {},
): Promise<EsitoSuggerimentiPiano> {
  const { modello, provider, nomeModello } = ottieniModello(opzioni)
  const iniziato = Date.now()
  const chiamata = (tentativi: number) =>
    generateObject({
      model: modello,
      schema: SchemaSuggerimentiPiano,
      system: costruisciPromptSuggerimenti(contesto),
      prompt:
        "Analizza le segnalazioni e proponi le modifiche meno invasive da verificare.",
      temperature: 0,
      maxRetries: tentativi,
    })

  let risultato
  try {
    risultato = await chiamata(0)
  } catch (primo) {
    if (eDefinitivo(primo)) throw traduciErrore(primo, provider, nomeModello)
    try {
      risultato = await chiamata(2)
    } catch (errore) {
      throw traduciErrore(errore, provider, nomeModello)
    }
  }

  return {
    ...risultato.object,
    provider,
    modello: nomeModello,
    latenzaMs: Date.now() - iniziato,
    tokenInput: risultato.usage?.inputTokens,
    tokenOutput: risultato.usage?.outputTokens,
  }
}
