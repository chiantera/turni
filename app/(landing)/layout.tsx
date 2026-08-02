import type { ReactNode } from "react"

// Questa descrizione è la copia più letta del sito: finisce nei risultati di
// ricerca e nelle anteprime dei link condivisi. Deve reggere quanto il resto.
export const metadata = {
  title: "Turni — Pianificazione dei turni di lavoro",
  description:
    "Pianifica i turni con un assistente in italiano e un solver deterministico: " +
    "copertura, monte ore e riposi verificati prima che il piano ti venga mostrato. " +
    "In beta pubblica, gratis.",
}

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-white">{children}</body>
    </html>
  )
}
