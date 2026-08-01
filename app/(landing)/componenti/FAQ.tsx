"use client"

import { useState } from "react"
import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12">
          Domande frequenti
        </h2>

        <div className="space-y-4">
          {LANDING_COPY.faq.map((item, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg overflow-hidden bg-white"
            >
              <button
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="w-full px-6 py-4 text-left font-semibold flex justify-between items-center hover:bg-gray-50 transition-colors"
                style={{ color: COLORS.textDark }}
              >
                <span>{item.q}</span>
                <span
                  className={`text-2xl transition-transform ${
                    openIdx === idx ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {openIdx === idx && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <p className="text-gray-700 leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
