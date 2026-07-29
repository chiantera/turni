/**
 * Traduzione degli errori dei provider AI in messaggi utili in italiano.
 *
 * Serve perché le condizioni più frequenti arrivano tutte come HTTP 429 o 401
 * con testo in inglese, e distinguerle cambia completamente cosa deve fare
 * l'utente: ricaricare il credito, correggere la chiave o semplicemente
 * riprovare fra un minuto. Un "429 Too Many Requests" generico manderebbe a
 * riprovare all'infinito chi invece ha finito il credito.
 */

import { APICallError, NoObjectGeneratedError } from "ai"

export function traduciErrore(
  e: unknown,
  provider: string,
  modello: string,
): Error {
  if (NoObjectGeneratedError.isInstance(e)) {
    return new Error(
      `Il modello ${modello} non ha prodotto una risposta valida. Riprova, ` +
        `oppure passa a un altro provider dalle impostazioni.`,
    )
  }

  // Gli errori di rete arrivano avvolti in un RetryError: il dettaglio utile
  // sta nell'ultimo tentativo.
  const causa =
    e && typeof e === "object" && "errors" in e && Array.isArray(e.errors)
      ? e.errors[e.errors.length - 1]
      : e

  if (APICallError.isInstance(causa)) {
    const testo = `${causa.responseBody ?? ""} ${causa.message ?? ""}`.toLowerCase()
    const stato = causa.statusCode

    if (
      testo.includes("insufficient balance") ||
      testo.includes("no resource package") ||
      testo.includes("quota") ||
      testo.includes("billing") ||
      testo.includes("credit")
    ) {
      return new Error(
        `Il credito dell'account ${provider} è esaurito: il provider rifiuta le ` +
          `richieste finché non viene ricaricato. La chiave è comunque valida. ` +
          `Puoi ricaricare, oppure cambiare provider da .env.local (AI_PROVIDER).`,
      )
    }
    if (stato === 401 || stato === 403 || testo.includes("invalid api key")) {
      return new Error(
        `Chiave API rifiutata da ${provider}. Controlla il valore in .env.local ` +
          `e ricorda di riavviare il server dopo averlo modificato.`,
      )
    }
    if (stato === 429) {
      return new Error(
        `Troppe richieste verso ${provider}: attendi qualche istante e riprova.`,
      )
    }
    if (stato === 404) {
      return new Error(
        `Il modello "${modello}" non esiste su ${provider}. Correggi AI_MODEL ` +
          `in .env.local.`,
      )
    }
    return new Error(`Errore da ${provider} (${stato ?? "?"}): ${causa.message}`)
  }

  return e instanceof Error ? e : new Error("Errore imprevisto.")
}

/**
 * true se l'errore non ha alcuna possibilità di risolversi riprovando.
 * Credito esaurito e chiave non valida arrivano come 429/401, che l'SDK
 * considera ritentabili: senza questo controllo si aspettano 9 secondi di
 * tentativi inutili prima di dire all'utente una cosa che si sapeva subito.
 */
export function eDefinitivo(e: unknown): boolean {
  const causa =
    e && typeof e === "object" && "errors" in e && Array.isArray(e.errors)
      ? e.errors[e.errors.length - 1]
      : e
  if (!APICallError.isInstance(causa)) return false
  const testo = `${causa.responseBody ?? ""} ${causa.message ?? ""}`.toLowerCase()
  return (
    testo.includes("insufficient balance") ||
    testo.includes("no resource package") ||
    causa.statusCode === 401 ||
    causa.statusCode === 403
  )
}
