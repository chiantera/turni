import type { ReactNode } from "react"

export const metadata = {
  title: "Turni — Pianificazione Turni Intelligente",
  description: "Pianificazione automatica dei turni con AI. Copertura garantita, zero scoperte.",
}

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-white">{children}</body>
    </html>
  )
}
