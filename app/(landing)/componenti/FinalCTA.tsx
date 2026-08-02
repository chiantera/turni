"use client"

import Link from "next/link"
import { useState } from "react"
import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

type StatoIscrizione = "attesa" | "invio" | "fatto" | "errore"

export default function FinalCTA() {
  const [email, setEmail] = useState("")
  // Campo esca per i bot: resta vuoto per chiunque usi davvero la pagina.
  const [azienda, setAzienda] = useState("")
  const [stato, setStato] = useState<StatoIscrizione>("attesa")
  const [messaggio, setMessaggio] = useState("")

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (stato === "invio") return

    setStato("invio")
    setMessaggio("")
    try {
      const risposta = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, azienda }),
      })
      const dati = await risposta.json().catch(() => ({}))
      if (!risposta.ok) {
        setStato("errore")
        setMessaggio(dati.errore || LANDING_COPY.cta.newsletterErrore)
        return
      }
      setStato("fatto")
      setMessaggio(LANDING_COPY.cta.newsletterOk)
      setEmail("")
    } catch {
      // Rete assente o richiesta interrotta: l'utente non deve restare a
      // fissare un pulsante che gira all'infinito.
      setStato("errore")
      setMessaggio(LANDING_COPY.cta.newsletterErrore)
    }
  }

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-semibold mb-4">
          {LANDING_COPY.cta.headline}
        </h2>

        <p className="text-lg text-gray-600 mb-8">
          {LANDING_COPY.cta.subheader}
        </p>

        <Link
          href="#richiedi-accesso"
          className="inline-block px-8 py-4 text-lg font-semibold rounded-lg text-white transition-all hover:opacity-90 mb-12"
          style={{ backgroundColor: COLORS.primary }}
        >
          {LANDING_COPY.cta.button}
        </Link>

        <div id="richiedi-accesso" className="max-w-md mx-auto pt-8 border-t scroll-mt-24">
          <p className="text-gray-600 mb-4">
            <label htmlFor="newsletter-email">{LANDING_COPY.cta.newsletter}</label>
          </p>
          <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
            <input
              id="newsletter-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={LANDING_COPY.cta.newsletterPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={stato === "invio"}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
            {/* Esca: nascosta agli occhi e alla navigazione assistita, ma
                compilata dai bot che riempiono ogni campo che trovano. */}
            <input
              type="text"
              name="azienda"
              value={azienda}
              onChange={(e) => setAzienda(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute h-0 w-0 opacity-0"
            />
            <button
              type="submit"
              disabled={stato === "invio"}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {stato === "invio"
                ? LANDING_COPY.cta.newsletterInvio
                : stato === "fatto"
                  ? "✓"
                  : LANDING_COPY.cta.newsletterBottone}
            </button>
          </form>

          <p
            role="status"
            aria-live="polite"
            className={`mt-3 text-sm min-h-[1.25rem] ${
              stato === "errore" ? "text-red-600" : "text-green-700"
            }`}
          >
            {messaggio}
          </p>

          <p className="mt-2 text-xs text-gray-500 leading-relaxed">
            {LANDING_COPY.cta.newsletterConsenso}
          </p>
        </div>
      </div>
    </section>
  )
}
