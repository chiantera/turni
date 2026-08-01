"use client"

import Link from "next/link"
import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

interface HeroSectionProps {
  onDemoClick?: () => void
}

export default function HeroSection({ onDemoClick }: HeroSectionProps) {
  return (
    <section
      className="min-h-[90vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primary}33 100%)`,
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full opacity-10 bg-white" />
      </div>

      <div className="relative z-10 max-w-3xl text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-2">
          {LANDING_COPY.hero.headline}
        </h1>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
          {LANDING_COPY.hero.headlineSecond}
        </h1>

        <p className="text-lg sm:text-xl text-white/90 mb-8 leading-relaxed max-w-2xl mx-auto">
          {LANDING_COPY.hero.subheader}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/accedi?action=signup"
            className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            {LANDING_COPY.hero.ctaPrimary}
          </Link>
          <button
            onClick={onDemoClick}
            className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
          >
            {LANDING_COPY.hero.ctaSecondary}
          </button>
        </div>
      </div>
    </section>
  )
}
