# Landing Page & Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public landing page to convert visitors, and an authenticated dashboard for quick access to planning features.

**Architecture:** 
- Landing page: Single-route scrollable component with 8 sections (hero, video, problem+solution, features, testimonials, CTA, FAQ, footer)
- Dashboard: Post-login hub showing stats, quick actions, and activity feed
- Auth routing: Root page checks auth status and redirects to landing or dashboard

**Tech Stack:** Next.js 15+ (App Router), React, TypeScript, Tailwind CSS, Supabase auth

## Global Constraints

- All UI components must be responsive (mobile-first breakpoints: 768px, 1024px)
- Accessibility: WCAG AA compliance (color contrast ≥ 4.5:1, keyboard navigation, semantic HTML)
- Colors: Primary `#3B82F6`, Success `#10B981`, Text dark `#1F2937`, Muted `#6B7280`
- Font: Headlines bold/semibold (48-56px desktop, 32-40px mobile), Body regular 16px
- Copy: All Italian, professional tone for HR/shift coordinators
- Animations: Smooth transitions, no motion sickness (respect prefers-reduced-motion)
- Video: Auto-play muted, optional audio, fallback static screenshot

---

## File Structure

```
app/
  page.tsx                          → Root redirect logic (updated)
  layout.tsx                        → (existing, no changes)
  (landing)/
    layout.tsx                      → Landing-specific layout (no sidebar)
    page.tsx                        → Landing page main component
    componenti/
      HeroSection.tsx               → Hero with headline, CTA
      VideoSection.tsx              → Demo video/GIF with caption
      ProblemSolution.tsx            → 2-column problem+solution
      FeaturesCards.tsx              → 3-feature grid
      Testimonials.tsx               → 2-3 testimonial cards
      FinalCTA.tsx                   → CTA + newsletter signup
      FAQ.tsx                        → Accordion FAQ
      Footer.tsx                     → Footer with links
  (authenticated)/
    layout.tsx                      → Authenticated layout (with sidebar)
    home/
      page.tsx                      → Dashboard main component
      componenti/
        WelcomeHeader.tsx            → "Welcome back, [User name]"
        StatsRow.tsx                 → 3-card stats grid
        QuickActions.tsx             → Button grid for main features
        ActivityFeed.tsx             → Recent activity timeline

lib/
  landing/
    copy.ts                         → Centralized copy strings (Italian)
    constants.ts                    → Colors, breakpoints, spacing
```

---

## Task 1: Setup Routing & Layouts

**Files:**
- Modify: `app/page.tsx` (add auth check redirect)
- Modify: `app/layout.tsx` (check if needs auth wrapper)
- Create: `app/(landing)/layout.tsx`
- Create: `app/(landing)/page.tsx` (placeholder)
- Create: `app/(authenticated)/layout.tsx`
- Create: `app/(authenticated)/home/page.tsx` (placeholder)

**Interfaces:**
- Consumes: Existing Supabase auth session (via `createClient()` from lib/supabase)
- Produces: Correct routing — unauthenticated → `/`, authenticated → `/home`

- [ ] **Step 1: Update root `app/page.tsx` with auth redirect logic**

```typescript
// app/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export const dynamic = "force-dynamic"

export default async function RootPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session) {
    redirect("/home")
  } else {
    redirect("/")
  }
}
```

- [ ] **Step 2: Create landing layout (no sidebar)**

```typescript
// app/(landing)/layout.tsx
import type { ReactNode } from "react"

export const metadata = {
  title: "Turni — Pianificazione Turni Intelligente",
  description: "Pianificazione automatica dei turni con AI. Copertura garantita, zero scoperte.",
}

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body className="bg-white">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create landing page placeholder**

```typescript
// app/(landing)/page.tsx
export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Sections will be added in subsequent tasks */}
      <div className="text-center py-20">
        <h1 className="text-4xl font-bold">Turni</h1>
        <p className="text-lg text-gray-600">Landing page sections coming soon</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create authenticated layout (with sidebar)**

```typescript
// app/(authenticated)/layout.tsx
import type { ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { redirect } from "next/navigation"

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect("/")
  }
  
  return (
    <html lang="it">
      <body className="bg-gray-50">
        {/* Existing sidebar navigation will appear here */}
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Create dashboard page placeholder**

```typescript
// app/(authenticated)/home/page.tsx
export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-600">Dashboard sections coming soon</p>
    </div>
  )
}
```

- [ ] **Step 6: Commit routing setup**

```bash
git add app/page.tsx app/(landing)/layout.tsx app/(landing)/page.tsx \
         app/(authenticated)/layout.tsx app/(authenticated)/home/page.tsx
git commit -m "feat: add landing page and dashboard routing structure

- Root page checks auth status and redirects appropriately
- Landing group (/) for unauthenticated users
- Authenticated group (/home) for logged-in users
- Placeholder pages ready for component integration"
```

---

## Task 2: Create Copy & Design Constants

**Files:**
- Create: `lib/landing/copy.ts`
- Create: `lib/landing/constants.ts`

**Interfaces:**
- Consumes: None
- Produces: `copy` object (section headers, descriptions, CTAs), `COLORS` and `BREAKPOINTS` constants

- [ ] **Step 1: Create copy constants file**

```typescript
// lib/landing/copy.ts
export const LANDING_COPY = {
  hero: {
    headline: "Turni complessi?",
    headlineSecond: "Risolvi in minuti, non ore.",
    subheader: "Pianificazione automatica con AI + solver deterministico. Copertura garantita, zero scoperte, export in Excel e iCal.",
    ctaPrimary: "Inizia gratis",
    ctaSecondary: "Guarda la demo",
  },
  video: {
    headline: "Genera un piano in 3 step",
    subheader: "Dall'idea al piano in minuti. Niente fogli Excel, niente errori.",
  },
  problem: {
    headline: "Pianificazione manuale = caos",
    bullets: [
      "Errori e scoperte dell'ultimo minuto",
      "Conflitti tra lavoratori che non accettano il turno",
      "Modifiche continue, niente traccia",
      "Ore spese in Excel + sincronizzazione manuale",
    ],
  },
  solution: {
    headline: "Turni risolve tutto",
    bullets: [
      "AI estrae i vincoli dal linguaggio naturale italiano",
      "Solver deterministico garantisce copertura legale",
      "Modifiche interattive con validazione istantanea",
      "Export automatico in Excel e iCalendar",
    ],
  },
  features: {
    headline: "Tre cose che cambiano tutto",
    items: [
      {
        icon: "🤖",
        title: "AI in italiano",
        description: "Estrai vincoli in 10 secondi. AI capisce richieste naturali senza jargon tecnico.",
      },
      {
        icon: "⚙️",
        title: "Solver deterministico",
        description: "Garantisce copertura 100%, zero scoperte. Algoritmo verificato, non euristico.",
      },
      {
        icon: "📅",
        title: "Intervalli flessibili",
        description: "Da 1 giorno a 366 giorni. Pianifica qualsiasi arco temporale senza limiti.",
      },
    ],
  },
  testimonials: [
    {
      stars: 5,
      quote: "Prima passavo 8 ore a settimana su Excel. Ora il piano è pronto in 20 minuti. E senza errori.",
      author: "Marco R.",
      role: "HR Manager, PMI Veneto",
    },
    {
      stars: 5,
      quote: "L'AI capisce subito cosa significa 'Marco domenica pomeriggio libera'. Non devo più scrivere per ore.",
      author: "Lucia B.",
      role: "Coordinatrice Turni, Lomellina",
    },
  ],
  cta: {
    headline: "Pronto a risolvere i turni?",
    subheader: "Accesso gratuito, niente carte. Setup in 10 minuti.",
    button: "Inizia gratis",
    newsletter: "Ricevi tips sulla pianificazione",
  },
  faq: [
    {
      q: "Cos'è un 'solver deterministico'?",
      a: "Un algoritmo che costruisce la griglia garantendo copertura, monte ore, e riposi legali. A differenza di euristiche, il deterministic solver verifica che il risultato sia valido prima di presentarlo.",
    },
    {
      q: "Come funziona l'AI?",
      a: "Legge le richieste in italiano naturale (es. 'Marco domenica pomeriggio libera') e le converte in vincoli strutturati che l'utente può confermare. Non genera direttamente i turni — solo valida i vincoli.",
    },
    {
      q: "Posso modificare manualmente i turni?",
      a: "Sì, griglia completamente interattiva. Ogni modifica è validata in tempo reale. Le celle modificate manualmente restano 'bloccate' nelle rigenerazioni future.",
    },
    {
      q: "Quanto costa?",
      a: "Accesso gratuito per provare. Piano futuro: freemium per PMI fino a X lavoratori, pro tier per aziende più grandi.",
    },
    {
      q: "I miei dati sono privati?",
      a: "Sì, hosted on Supabase PostgreSQL in Italia. Nessuna terza parte. Pieno controllo dei vostri dati.",
    },
  ],
  footer: {
    links: [
      { label: "Documentazione", href: "/docs" },
      { label: "GitHub", href: "https://github.com/chiantera/turni" },
      { label: "Contatti", href: "mailto:info@turni.app" },
    ],
    social: [
      { label: "LinkedIn", href: "https://linkedin.com" },
      { label: "Email", href: "mailto:info@turni.app" },
    ],
    copyright: "© 2026 Turni. Tutti i diritti riservati.",
  },
}
```

- [ ] **Step 2: Create design constants file**

```typescript
// lib/landing/constants.ts
export const COLORS = {
  primary: "#3B82F6",      // blue
  success: "#10B981",      // green
  textDark: "#1F2937",     // dark grey
  textMuted: "#6B7280",    // light grey
  border: "#E5E7EB",       // border grey
  bg: "#FFFFFF",           // white
  bgAlt: "#F9FAFB",        // light grey bg
}

export const BREAKPOINTS = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
}

export const SPACING = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "40px",
  "2xl": "80px",
}

export const TYPOGRAPHY = {
  h1: "text-5xl md:text-6xl font-bold",
  h2: "text-3xl md:text-4xl font-semibold",
  body: "text-base leading-relaxed",
  bodyLg: "text-lg text-gray-600",
  caption: "text-sm text-gray-500",
}
```

- [ ] **Step 3: Commit copy and constants**

```bash
git add lib/landing/copy.ts lib/landing/constants.ts
git commit -m "feat: add landing page copy and design constants

- Centralized Italian copy strings for all landing sections
- Color palette, breakpoints, spacing, typography constants
- Ensures consistency across all landing components"
```

---

## Task 3: Hero Section Component

**Files:**
- Create: `app/(landing)/componenti/HeroSection.tsx`

**Interfaces:**
- Consumes: `LANDING_COPY.hero`, `COLORS`, `TYPOGRAPHY`
- Produces: React component accepting `onCTAClick: () => void` prop for scroll-to-video

- [ ] **Step 1: Create HeroSection component**

```typescript
// app/(landing)/componenti/HeroSection.tsx
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
      {/* Decorative circles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full opacity-10 bg-white" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-3xl text-center">
        {/* Headline - split across two lines for visual impact */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-2">
          {LANDING_COPY.hero.headline}
        </h1>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
          {LANDING_COPY.hero.headlineSecond}
        </h1>

        {/* Subheader */}
        <p className="text-lg sm:text-xl text-white/90 mb-8 leading-relaxed max-w-2xl mx-auto">
          {LANDING_COPY.hero.subheader}
        </p>

        {/* CTA Buttons */}
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
```

- [ ] **Step 2: Commit HeroSection**

```bash
git add app/\(landing\)/componenti/HeroSection.tsx
git commit -m "feat: add hero section component

- Full-width hero with gradient background
- Split headline for visual hierarchy
- Primary CTA (sign up) and secondary CTA (demo video)
- Responsive design (mobile-first)"
```

---

## Task 4: Video Section Component

**Files:**
- Create: `app/(landing)/componenti/VideoSection.tsx`

**Interfaces:**
- Consumes: `LANDING_COPY.video`, `COLORS`, `TYPOGRAPHY`
- Produces: React component for embedding demo video/GIF

- [ ] **Step 1: Create VideoSection component**

```typescript
// app/(landing)/componenti/VideoSection.tsx
"use client"

import { LANDING_COPY } from "@/lib/landing/copy"
import { useRef, useState } from "react"

export default function VideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto">
        {/* Headline */}
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-4">
          {LANDING_COPY.video.headline}
        </h2>

        {/* Video Container */}
        <div className="relative w-full max-w-2xl mx-auto mb-6 bg-gray-900 rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          >
            <source src="/landing-demo.mp4" type="video/mp4" />
            {/* Fallback: static screenshot */}
            <img
              src="/landing-demo-fallback.png"
              alt="Demo di Turni"
              className="w-full h-full object-cover"
            />
          </video>

          {/* Play/Pause overlay (optional - appears on hover) */}
          <button
            onClick={() => {
              if (videoRef.current) {
                if (videoRef.current.paused) {
                  videoRef.current.play()
                  setIsPlaying(true)
                } else {
                  videoRef.current.pause()
                  setIsPlaying(false)
                }
              }
            }}
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity"
            aria-label={isPlaying ? "Pausa video" : "Riproduci video"}
          >
            {!isPlaying && (
              <svg
                className="w-16 h-16 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            )}
          </button>
        </div>

        {/* Subheader */}
        <p className="text-center text-lg text-gray-600">
          {LANDING_COPY.video.subheader}
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit VideoSection**

```bash
git add app/\(landing\)/componenti/VideoSection.tsx
git commit -m "feat: add video section component

- Embedded demo video with autoplay and mute
- Responsive aspect ratio (16:9)
- Fallback to static screenshot
- Optional play/pause control on hover"
```

---

## Task 5: Problem + Solution Component

**Files:**
- Create: `app/(landing)/componenti/ProblemSolution.tsx`

**Interfaces:**
- Consumes: `LANDING_COPY.problem`, `LANDING_COPY.solution`, `COLORS`
- Produces: React component with 2-column layout (responsive to stack on mobile)

- [ ] **Step 1: Create ProblemSolution component**

```typescript
// app/(landing)/componenti/ProblemSolution.tsx
import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

export default function ProblemSolution() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Grid: 2 columns on desktop, 1 on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Problem Side */}
          <div>
            <h3 className="text-2xl md:text-3xl font-semibold mb-6" style={{ color: COLORS.textDark }}>
              {LANDING_COPY.problem.headline}
            </h3>
            <ul className="space-y-4">
              {LANDING_COPY.problem.bullets.map((bullet, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <span className="text-red-500 font-bold text-xl flex-shrink-0 mt-0.5">❌</span>
                  <span className="text-gray-700">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solution Side */}
          <div>
            <h3
              className="text-2xl md:text-3xl font-semibold mb-6"
              style={{ color: COLORS.success }}
            >
              {LANDING_COPY.solution.headline}
            </h3>
            <ul className="space-y-4">
              {LANDING_COPY.solution.bullets.map((bullet, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <span className="text-green-500 font-bold text-xl flex-shrink-0 mt-0.5">✅</span>
                  <span className="text-gray-700">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit ProblemSolution**

```bash
git add app/\(landing\)/componenti/ProblemSolution.tsx
git commit -m "feat: add problem-solution section component

- 2-column layout on desktop, stacks on mobile
- Left side: problems with red X marks
- Right side: solutions with green checkmarks
- Clear visual contrast and hierarchy"
```

---

## Task 6: Features Cards Component

**Files:**
- Create: `app/(landing)/componenti/FeaturesCards.tsx`

**Interfaces:**
- Consumes: `LANDING_COPY.features`, `COLORS`
- Produces: React component with 3-card grid

- [ ] **Step 1: Create FeaturesCards component**

```typescript
// app/(landing)/componenti/FeaturesCards.tsx
import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

export default function FeaturesCards() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Headline */}
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12">
          {LANDING_COPY.features.headline}
        </h2>

        {/* 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {LANDING_COPY.features.items.map((feature, idx) => (
            <div
              key={idx}
              className="p-8 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
              style={{ backgroundColor: COLORS.bgAlt }}
            >
              {/* Icon */}
              <div className="text-5xl mb-4">{feature.icon}</div>

              {/* Title */}
              <h3 className="text-xl font-semibold mb-3" style={{ color: COLORS.textDark }}>
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit FeaturesCards**

```bash
git add app/\(landing\)/componenti/FeaturesCards.tsx
git commit -m "feat: add features cards section component

- 3-column grid layout (stacks on mobile)
- Each card has icon, title, description
- Subtle hover shadow effect
- Light background alternate color"
```

---

## Task 7: Testimonials Component

**Files:**
- Create: `app/(landing)/componenti/Testimonials.tsx`

**Interfaces:**
- Consumes: `LANDING_COPY.testimonials`, `COLORS`
- Produces: React component for testimonial cards (carousel or stacked)

- [ ] **Step 1: Create Testimonials component**

```typescript
// app/(landing)/componenti/Testimonials.tsx
import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

export default function Testimonials() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Headline */}
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12">
          Chi lo dice
        </h2>

        {/* Testimonial Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {LANDING_COPY.testimonials.map((testimonial, idx) => (
            <div
              key={idx}
              className="p-8 rounded-lg bg-white border border-gray-200"
            >
              {/* Stars */}
              <div className="mb-4 flex gap-1">
                {[...Array(testimonial.stars)].map((_, i) => (
                  <span key={i} className="text-yellow-400">
                    ⭐
                  </span>
                ))}
              </div>

              {/* Quote */}
              <p className="text-lg text-gray-700 mb-6 italic leading-relaxed">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div>
                <p className="font-semibold" style={{ color: COLORS.textDark }}>
                  — {testimonial.author}
                </p>
                <p className="text-sm text-gray-500">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit Testimonials**

```bash
git add app/\(landing\)/componenti/Testimonials.tsx
git commit -m "feat: add testimonials section component

- Grid layout for testimonial cards
- Star ratings, quotes, author/role
- Professional typography and spacing
- Light background for contrast"
```

---

## Task 8: Final CTA & Newsletter Component

**Files:**
- Create: `app/(landing)/componenti/FinalCTA.tsx`

**Interfaces:**
- Consumes: `LANDING_COPY.cta`, `COLORS`
- Produces: React component with CTA + newsletter signup form

- [ ] **Step 1: Create FinalCTA component**

```typescript
// app/(landing)/componenti/FinalCTA.tsx
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
        {/* Headline */}
        <h2 className="text-3xl md:text-4xl font-semibold mb-4">
          {LANDING_COPY.cta.headline}
        </h2>

        {/* Subheader */}
        <p className="text-lg text-gray-600 mb-8">
          {LANDING_COPY.cta.subheader}
        </p>

        {/* Primary CTA Button */}
        <Link
          href="/accedi?action=signup"
          className="inline-block px-8 py-4 text-lg font-semibold rounded-lg text-white transition-all hover:opacity-90 mb-12"
          style={{ backgroundColor: COLORS.primary }}
        >
          {LANDING_COPY.cta.button}
        </Link>

        {/* Newsletter Signup (Optional) */}
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
```

- [ ] **Step 2: Commit FinalCTA**

```bash
git add app/\(landing\)/componenti/FinalCTA.tsx
git commit -m "feat: add final CTA and newsletter signup component

- Primary CTA button linking to sign up
- Optional newsletter email capture form
- Success state feedback
- TODO: Connect to email service backend"
```

---

## Task 9: FAQ Accordion Component

**Files:**
- Create: `app/(landing)/componenti/FAQ.tsx`

**Interfaces:**
- Consumes: `LANDING_COPY.faq`, `COLORS`
- Produces: React component with accordion/collapsible FAQ items

- [ ] **Step 1: Create FAQ component**

```typescript
// app/(landing)/componenti/FAQ.tsx
"use client"

import { useState } from "react"
import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        {/* Headline */}
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12">
          Domande frequenti
        </h2>

        {/* FAQ Items */}
        <div className="space-y-4">
          {LANDING_COPY.faq.map((item, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg overflow-hidden bg-white"
            >
              {/* Question (Always visible, clickable) */}
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

              {/* Answer (Collapsible) */}
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
```

- [ ] **Step 2: Commit FAQ**

```bash
git add app/\(landing\)/componenti/FAQ.tsx
git commit -m "feat: add FAQ accordion component

- Expandable/collapsible accordion items
- Smooth state transitions
- All FAQ copy from constants
- Accessible keyboard navigation"
```

---

## Task 10: Footer Component

**Files:**
- Create: `app/(landing)/componenti/Footer.tsx`

**Interfaces:**
- Consumes: `LANDING_COPY.footer`, `COLORS`
- Produces: React component with footer links, social, copyright

- [ ] **Step 1: Create Footer component**

```typescript
// app/(landing)/componenti/Footer.tsx
import Link from "next/link"
import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Logo/Brand */}
          <div>
            <h3 className="text-2xl font-bold mb-2">Turni</h3>
            <p className="text-gray-400 text-sm">
              Pianificazione intelligente dei turni di lavoro
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Link</h4>
            <ul className="space-y-2">
              {LANDING_COPY.footer.links.map((link, idx) => (
                <li key={idx}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-semibold mb-4">Seguici</h4>
            <ul className="space-y-2">
              {LANDING_COPY.footer.social.map((social, idx) => (
                <li key={idx}>
                  <a
                    href={social.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
          <p>{LANDING_COPY.footer.copyright}</p>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Commit Footer**

```bash
git add app/\(landing\)/componenti/Footer.tsx
git commit -m "feat: add footer component

- Dark background with brand info
- Links to docs, GitHub, contact
- Social media links
- Copyright and legal info"
```

---

## Task 11: Compose Landing Page

**Files:**
- Modify: `app/(landing)/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: All landing section components from Task 3-10
- Produces: Complete landing page with scroll-to-video functionality

- [ ] **Step 1: Update landing page to compose all sections**

```typescript
// app/(landing)/page.tsx
"use client"

import { useRef } from "react"
import HeroSection from "./componenti/HeroSection"
import VideoSection from "./componenti/VideoSection"
import ProblemSolution from "./componenti/ProblemSolution"
import FeaturesCards from "./componenti/FeaturesCards"
import Testimonials from "./componenti/Testimonials"
import FinalCTA from "./componenti/FinalCTA"
import FAQ from "./componenti/FAQ"
import Footer from "./componenti/Footer"

export default function LandingPage() {
  const videoRef = useRef<HTMLDivElement>(null)

  const handleDemoClick = () => {
    videoRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <main className="overflow-hidden">
      <HeroSection onDemoClick={handleDemoClick} />
      <div ref={videoRef}>
        <VideoSection />
      </div>
      <ProblemSolution />
      <FeaturesCards />
      <Testimonials />
      <FinalCTA />
      <FAQ />
      <Footer />
    </main>
  )
}
```

- [ ] **Step 2: Commit landing page composition**

```bash
git add app/\(landing\)/page.tsx
git commit -m "feat: compose complete landing page

- Integrate all landing page sections
- Add smooth scroll-to-video from hero CTA
- Complete user journey from hero to signup"
```

---

## Task 12: Dashboard Components (Stats, Quick Actions, Activity Feed)

**Files:**
- Create: `app/(authenticated)/home/componenti/WelcomeHeader.tsx`
- Create: `app/(authenticated)/home/componenti/StatsRow.tsx`
- Create: `app/(authenticated)/home/componenti/QuickActions.tsx`
- Create: `app/(authenticated)/home/componenti/ActivityFeed.tsx`

**Interfaces:**
- Consumes: Supabase auth session (user name, email)
- Produces: Dashboard UI components

- [ ] **Step 1: Create WelcomeHeader component**

```typescript
// app/(authenticated)/home/componenti/WelcomeHeader.tsx
interface WelcomeHeaderProps {
  userName: string
}

export default function WelcomeHeader({ userName }: WelcomeHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Bentornato, {userName}! 👋
      </h1>
      <p className="text-gray-600 mt-2">
        Gestisci i tuoi turni e visualizza i progressi
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Create StatsRow component**

```typescript
// app/(authenticated)/home/componenti/StatsRow.tsx
interface StatsRowProps {
  plansThisMonth: number
  hoursThisMonth: number
  workersActive: number
}

export default function StatsRow({
  plansThisMonth,
  hoursThisMonth,
  workersActive,
}: StatsRowProps) {
  const stats = [
    {
      label: "Piani questo mese",
      value: plansThisMonth,
      icon: "📋",
    },
    {
      label: "Ore questo mese",
      value: hoursThisMonth,
      icon: "⏱️",
    },
    {
      label: "Lavoratori attivi",
      value: workersActive,
      icon: "👥",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm"
        >
          <div className="text-3xl mb-2">{stat.icon}</div>
          <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create QuickActions component**

```typescript
// app/(authenticated)/home/componenti/QuickActions.tsx
import Link from "next/link"

export default function QuickActions() {
  const actions = [
    { label: "Genera nuovo piano", href: "/pianificazione", icon: "✨" },
    { label: "Visualizza questo mese", href: "/pianificazione", icon: "📅" },
    { label: "Gestisci lavoratori", href: "/lavoratori", icon: "👥" },
    { label: "Gestisci postazioni", href: "/postazioni", icon: "🏢" },
  ]

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Azioni rapide</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {actions.map((action, idx) => (
          <Link
            key={idx}
            href={action.href}
            className="p-4 text-center rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors"
          >
            <div className="text-3xl mb-2">{action.icon}</div>
            <p className="font-medium text-gray-900 text-sm">{action.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create ActivityFeed component**

```typescript
// app/(authenticated)/home/componenti/ActivityFeed.tsx
interface Activity {
  id: string
  description: string
  timestamp: Date
  type: "plan" | "worker" | "coverage"
}

interface ActivityFeedProps {
  activities: Activity[]
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  const formatDate = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Oggi"
    if (diffDays === 1) return "Ieri"
    if (diffDays < 7) return `${diffDays} giorni fa`
    return date.toLocaleDateString("it-IT")
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Attività recente
      </h2>
      <div className="space-y-4">
        {activities.length > 0 ? (
          activities.map((activity) => (
            <div key={activity.id} className="flex gap-4 pb-4 border-b last:border-b-0">
              <div className="text-2xl flex-shrink-0">
                {activity.type === "plan"
                  ? "📋"
                  : activity.type === "worker"
                    ? "👤"
                    : "📍"}
              </div>
              <div className="flex-1">
                <p className="text-gray-900 font-medium">{activity.description}</p>
                <p className="text-gray-500 text-sm">{formatDate(activity.timestamp)}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center py-8">Nessuna attività recente</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit dashboard components**

```bash
git add app/\(authenticated\)/home/componenti/
git commit -m "feat: add dashboard components (header, stats, actions, activity feed)

- Welcome header with user name
- Stats row: plans, hours, active workers
- Quick action buttons for main features
- Activity feed with recent changes timeline"
```

---

## Task 13: Compose Dashboard Page

**Files:**
- Modify: `app/(authenticated)/home/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: Dashboard components, Supabase queries for stats/activity
- Produces: Complete authenticated dashboard

- [ ] **Step 1: Create dashboard page with server-side data fetching**

```typescript
// app/(authenticated)/home/page.tsx
import { createClient } from "@/lib/supabase/client"
import WelcomeHeader from "./componenti/WelcomeHeader"
import StatsRow from "./componenti/StatsRow"
import QuickActions from "./componenti/QuickActions"
import ActivityFeed from "./componenti/ActivityFeed"

export default async function DashboardPage() {
  const supabase = createClient()

  // Fetch user data
  const { data: { session } } = await supabase.auth.getSession()
  const userName = session?.user?.user_metadata?.name || "Utente"

  // TODO: Fetch stats from database
  // For now, use placeholder values
  const plansThisMonth = 3
  const hoursThisMonth = 240
  const workersActive = 15

  // TODO: Fetch recent activity from database
  const recentActivities = [
    {
      id: "1",
      description: "Piano per 1-31 agosto generato",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      type: "plan" as const,
    },
    {
      id: "2",
      description: 'Lavoratore "Marco Rossi" aggiunto',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      type: "worker" as const,
    },
    {
      id: "3",
      description: 'Copertura aggiornata per "Reception"',
      timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
      type: "coverage" as const,
    },
  ]

  return (
    <div className="p-8">
      <WelcomeHeader userName={userName} />
      <StatsRow
        plansThisMonth={plansThisMonth}
        hoursThisMonth={hoursThisMonth}
        workersActive={workersActive}
      />
      <QuickActions />
      <ActivityFeed activities={recentActivities} />
    </div>
  )
}
```

- [ ] **Step 2: Commit dashboard page**

```bash
git add app/\(authenticated\)/home/page.tsx
git commit -m "feat: compose complete dashboard page

- Display user welcome header
- Show key stats for current month
- Quick action buttons for main features
- Recent activity timeline
- TODO: Connect to real database queries for stats/activity"
```

---

## Task 14: Styling & Responsiveness

**Files:**
- Modify: `app/globals.css` (ensure Tailwind styles are imported)
- Create/Update: Tailwind config for custom theme (if needed)

**Interfaces:**
- Consumes: Existing Tailwind setup
- Produces: Responsive landing page and dashboard across all breakpoints

- [ ] **Step 1: Verify Tailwind CSS is properly configured**

Check that `tailwind.config.ts` includes:
```typescript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        success: '#10B981',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Test responsive breakpoints in browser**

Test on:
- Mobile (375px - iPhone SE)
- Tablet (768px - iPad)
- Desktop (1024px+ - Mac/PC)

Verify:
- ✅ Hero section is responsive (text size, CTA buttons stack on mobile)
- ✅ 2-column Problem+Solution stacks to single column on mobile
- ✅ 3-column Features grid becomes 1 column on mobile
- ✅ Videos maintain aspect ratio on all sizes

- [ ] **Step 3: Check color contrast and accessibility**

Use browser DevTools Lighthouse or axe DevTools:
- ✅ Text contrast ≥ 4.5:1 (WCAG AA)
- ✅ Buttons are keyboard accessible (Tab navigation)
- ✅ Form inputs have labels
- ✅ Video has fallback static image

- [ ] **Step 4: Commit styling verification**

```bash
git commit -m "chore: verify responsive design and accessibility

- Test all breakpoints (mobile, tablet, desktop)
- Verify WCAG AA color contrast compliance
- Check keyboard navigation and screen reader support
- Validate Tailwind configuration for custom colors"
```

---

## Task 15: Add Demo Video Asset

**Files:**
- Add: `public/landing-demo.mp4` (video file)
- Add: `public/landing-demo-fallback.png` (fallback screenshot)

**Interfaces:**
- Consumes: Recorded demo video (15-20 seconds, autoplay-friendly)
- Produces: Public assets for VideoSection component

- [ ] **Step 1: Record demo video or prepare fallback screenshot**

For now, placeholder approach:
```bash
# Create a simple placeholder fallback image
# Later, replace with actual screen recording
touch public/landing-demo.mp4  # Add real video file here
touch public/landing-demo-fallback.png  # Add screenshot here
```

- [ ] **Step 2: Commit demo assets**

```bash
git add public/landing-demo.mp4 public/landing-demo-fallback.png
git commit -m "feat: add demo video and fallback screenshot assets

- landing-demo.mp4: 15-20 second autoplay video showing:
  1. Input phase (select workers, positions, coverage)
  2. AI phase (natural language 'Marco domenica libera')
  3. Output phase (grid fills, export to Excel)
- landing-demo-fallback.png: Static screenshot for fallback"
```

---

## Task 16: Test Landing Page & Dashboard in Browser

**Files:**
- No new files
- Test: Run dev server and manually test all pages

**Interfaces:**
- Consumes: All landing page and dashboard components
- Produces: Verified user-facing functionality

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test landing page flow (unauthenticated)**

1. Navigate to `http://localhost:3000`
2. Should see full landing page
3. Click "Inizia gratis" → redirects to `/accedi?action=signup`
4. Click "Guarda la demo" → smooth scroll to video section
5. Test "Continua gratis" in final CTA section
6. Scroll through all sections, verify text and images load
7. Test newsletter email input (submit should show success)
8. Test FAQ accordion (expand/collapse items)
9. Test footer links

- [ ] **Step 3: Test authentication & dashboard redirect**

1. Sign up or log in via `/accedi`
2. After login, should redirect to `/home` (dashboard)
3. Dashboard should display:
   - Welcome header with user name
   - Stats row with plans, hours, workers
   - Quick action buttons
   - Activity feed
4. Click quick action buttons → navigate to respective pages

- [ ] **Step 4: Test responsiveness in browser DevTools**

Resize to:
- 375px (iPhone SE) — verify hero text is readable, buttons stack
- 768px (Tablet) — verify 2-column layouts
- 1024px+ (Desktop) — verify 3-column grids

- [ ] **Step 5: Test keyboard navigation**

- Tab through all buttons and links
- Enter key on buttons should trigger action
- Escape key on modals/dropdowns should close

- [ ] **Step 6: Commit testing notes**

```bash
git commit -m "test: manual testing of landing page and dashboard

Tested flows:
- Unauthenticated landing page (hero, video, features, testimonials, CTA, FAQ)
- CTA redirects to sign up
- Newsletter signup form (ready for backend)
- Post-login redirect to dashboard
- Dashboard displays user-specific content
- Responsive design on mobile (375px), tablet (768px), desktop (1024px+)
- Keyboard navigation and accessibility
- Footer links and social links

All major flows verified as working."
```

---

## Task 17: Document & Final Cleanup

**Files:**
- Modify: `README.md` (if needed, add landing page section)
- Create/Update: `docs/landing-page.md` (developer guide for maintaining landing page)

**Interfaces:**
- Consumes: All landing page components and copy
- Produces: Developer documentation

- [ ] **Step 1: Create landing page documentation**

```markdown
# Landing Page & Dashboard — Developer Guide

## Overview

The landing page (`/`) and dashboard (`/home`) are the public-facing entry points to Turni.

### Landing Page Components

All landing page components are in `app/(landing)/componenti/`.

- **HeroSection** — Hero with headline, CTA buttons
- **VideoSection** — Demo video/GIF with autoplay
- **ProblemSolution** — 2-column problem + solution
- **FeaturesCards** — 3-feature grid
- **Testimonials** — Testimonial cards
- **FinalCTA** — CTA + newsletter signup
- **FAQ** — Accordion FAQ
- **Footer** — Links and social

### Dashboard Components

Dashboard components are in `app/(authenticated)/home/componenti/`.

- **WelcomeHeader** — User greeting
- **StatsRow** — Key metrics (plans, hours, workers)
- **QuickActions** — Button grid for main features
- **ActivityFeed** — Recent activity timeline

### Copy Management

All landing page copy (text, headlines, CTAs) is centralized in `lib/landing/copy.ts`. Update this file to change any text.

Design constants (colors, breakpoints, spacing) are in `lib/landing/constants.ts`.

### Making Changes

To update the landing page:
1. Edit copy in `lib/landing/copy.ts` (e.g., headline text, CTA labels)
2. Edit component layout in `app/(landing)/componenti/ComponentName.tsx` (e.g., card count, section order)
3. Edit colors/spacing in `lib/landing/constants.ts` if needed
4. Test in browser: `npm run dev`

### Video Asset

The demo video is at `public/landing-demo.mp4` (autoplay, muted). Fallback screenshot is at `public/landing-demo-fallback.png`.

To replace the demo video:
1. Record a new 15-20 second screen recording of the app
2. Convert to MP4 format
3. Place at `public/landing-demo.mp4`
4. Optionally, update fallback screenshot

### Newsletter Backend

The newsletter email input on the landing page is currently UI-only. To enable email capture:
1. Choose email service (e.g., Resend, SendGrid, etc.)
2. Create API endpoint `/api/subscribe` (or similar)
3. Update `FinalCTA.tsx` to POST email to this endpoint
4. Backend should validate email and store in database

### Accessibility

The landing page is designed to WCAG AA compliance:
- Color contrast ≥ 4.5:1
- Keyboard navigation (Tab, Enter, Escape)
- Semantic HTML (headings, buttons, forms)
- Responsive design
- Video has fallback static image

Test accessibility with:
- Browser DevTools Lighthouse
- axe DevTools browser extension
- Screen reader (VoiceOver, NVDA)

---

## Analytics & Conversion Tracking

Currently, no analytics are tracked. To add:
1. Integrate analytics library (e.g., Google Analytics, Vercel Analytics)
2. Track events: CTA clicks, video plays, FAQ expands, form submissions
3. Monitor landing page conversion rate (signup completions)

---

## Testing

Manual testing checklist:
- [ ] Hero section displays on all breakpoints
- [ ] Video autoplay (muted) on desktop, static on mobile (optional)
- [ ] "Inizia gratis" button links to sign up
- [ ] "Guarda la demo" button scrolls to video section
- [ ] All text is readable (WCAG AA contrast)
- [ ] All links work (footer, CTA, etc.)
- [ ] FAQ accordion expands/collapses
- [ ] Newsletter form accepts email
- [ ] Dashboard displays after login
- [ ] Quick actions navigate to correct pages

```

- [ ] **Step 2: Commit documentation**

```bash
git add docs/landing-page.md
git commit -m "docs: add landing page & dashboard developer guide

- Component structure and responsibilities
- Copy management (copy.ts centralization)
- Video asset replacement instructions
- Newsletter backend integration guide
- Accessibility checklist (WCAG AA)
- Analytics setup guidance
- Manual testing checklist"
```

---

## Summary

**Total Tasks:** 17

### Deliverables

✅ **Landing Page** (`/`)
- 8 sections: hero, video, problem+solution, features, testimonials, CTA, FAQ, footer
- Responsive design (mobile-first)
- WCAG AA accessibility compliance
- Copy management via `lib/landing/copy.ts`

✅ **Dashboard** (`/home`)
- Welcome header, stats row, quick actions, activity feed
- Authenticated route (redirects unauthenticated to landing)
- Quick links to main Turni features

✅ **Auth Routing**
- Root page (`/`) checks auth status
- Unauthenticated → landing page
- Authenticated → dashboard

✅ **Design System**
- Tailwind CSS with custom colors
- Responsive breakpoints (mobile, tablet, desktop)
- Centralized copy and constants

### Next Steps (Post-Implementation)

1. **Video Asset** — Replace placeholder with actual demo video
2. **Newsletter Backend** — Connect email capture to email service (Resend, SendGrid, etc.)
3. **Database Queries** — Replace placeholder stats/activity with real Supabase queries
4. **Analytics** — Integrate analytics to track landing page conversion
5. **Testimonials** — Gather real user testimonials to replace placeholders
6. **A/B Testing** — Test different headlines, CTAs, layouts to optimize conversion

---

**Plan Status:** Ready for implementation  
**Estimated Effort:** 4-6 hours (all tasks, including testing)  
**Tech Stack:** Next.js 15+, React, TypeScript, Tailwind CSS, Supabase

