"use client"

import Link from "next/link"
import { useState } from "react"
import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

export default function FinalCTA() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Connect to email service (Resend, etc.)
    setSubmitted(true)
    setTimeout(() => {
      setEmail("")
      setSubmitted(false)
    }, 3000)
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
          href="/accedi?action=signup"
          className="inline-block px-8 py-4 text-lg font-semibold rounded-lg text-white transition-all hover:opacity-90 mb-12"
          style={{ backgroundColor: COLORS.primary }}
        >
          {LANDING_COPY.cta.button}
        </Link>

        <div className="max-w-md mx-auto pt-8 border-t">
          <p className="text-gray-600 mb-4">{LANDING_COPY.cta.newsletter}</p>
          <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              {submitted ? "✓" : "Iscriviti"}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
