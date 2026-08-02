import { redirect } from "next/navigation"

import { percorsoPianificazioneCorrente } from "@/lib/dati/formato"

export const dynamic = "force-dynamic"

/**
 * `/pianificazione` senza mese: manda al mese corrente.
 *
 * Il piano vive su `/pianificazione/[mese]`, quindi il segmento nudo dava 404.
 * Ci si arriva da più parti — un pulsante della dashboard, un indirizzo
 * digitato a mano, un segnalibro, e anche i suggerimenti dell'AI, che elencano
 * "/pianificazione" fra i percorsi proponibili (`lib/ai/suggerimenti-piano.ts`).
 * Tapparle una alla volta avrebbe lasciato scoperte le altre.
 */
export default function PianificazioneSenzaMese() {
  redirect(percorsoPianificazioneCorrente())
}
