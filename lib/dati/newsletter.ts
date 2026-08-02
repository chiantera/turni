/** Lunghezza massima di un indirizzo email secondo la RFC 5321. */
export const MAX_LUNGHEZZA_EMAIL = 254

// Volutamente permissiva: il compito qui è scartare ciò che non è
// plausibilmente un indirizzo, non decidere quali indirizzi esistono. Un
// controllo troppo severo rifiuta caselle valide, e l'unica prova che un
// indirizzo funzioni resta il messaggio di conferma.
const FORMA_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Normalizza un indirizzo per la newsletter, oppure null se non è plausibile.
 *
 * La stessa normalizzazione vive anche in `iscrivi_newsletter()`: qui serve a
 * dare una risposta immediata a chi compila il form, nel database a garantire
 * che il vincolo di unicità veda sempre la stessa forma dell'indirizzo.
 */
export function normalizzaEmail(valore: unknown): string | null {
  if (typeof valore !== "string") return null
  const pulita = valore.trim().toLowerCase()
  if (pulita.length === 0 || pulita.length > MAX_LUNGHEZZA_EMAIL) return null
  if (!FORMA_EMAIL.test(pulita)) return null
  return pulita
}
