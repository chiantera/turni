# Landing Page & Dashboard Design — Turni

**Date:** 2026-08-01  
**Project:** Turni — Shift Planning with AI  
**Scope:** Public landing page (pre-login) + authenticated dashboard  
**Target Users:** HR managers, shift coordinators, Italian SMEs  

---

## Overview

Turni needs **two distinct pages:**

1. **Public Landing Page** (`/`) — Pre-login marketing & conversion funnel
2. **Authenticated Dashboard** (`/dashboard` or `/home`) — Post-login welcome screen & quick access

This spec covers **both**. The public landing page uses a hybrid approach (problem-narrative + ROI-driven features), while the dashboard is a quick-access hub for authenticated users.

---

## 1. PUBLIC LANDING PAGE (`/`)

### Purpose
Convert visitors into signups by:
- Immediately communicating the pain (manual shift planning is chaotic)
- Showing the solution (Turni solves it automatically)
- Building trust via features, social proof, and testimonials
- Clear, frictionless call-to-action

### Architecture
Single scrollable page with **8 sections:**

1. Hero section
2. Video/demo GIF
3. Problem + Solution (side-by-side)
4. Key features (3 cards)
5. Testimonials (2-3 quotes)
6. CTA final + newsletter
7. FAQ (accordion)
8. Footer

### Detailed Sections

#### 1.1 Hero Section

**Layout:** Full-width hero with centered text overlay + optional background image

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Headline (h1, large, bold):                        │
│  "Turni complessi?"                                │
│  "Risolvi in minuti, non ore."                     │
│                                                     │
│  Subheader (body-lg, grey-600):                    │
│  "Pianificazione automatica con AI + solver        │
│   deterministico. Copertura garantita,             │
│   zero scoperte, export in Excel e iCal."          │
│                                                     │
│  Buttons:                                          │
│  [Primary] "Inizia gratis"                         │
│  [Secondary] "Guarda la demo" (scroll-to video)    │
│                                                     │
│  Background:                                       │
│  - Option A: Gradient (blue → lighter blue)        │
│  - Option B: Subtle pattern overlay                │
│  - Option C: Photo of team/HR manager at desk      │
│  (Recommendation: Gradient for speed, cleanliness) │
│                                                     │
│  Height: 80-90vh on desktop, responsive            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Copy Details:**
- Headline: Problem-focused, relatable to HR personas
- Subheader: Lists 3 key outcomes (automatic, coverage, export)
- Primary CTA: "Inizia gratis" (free trial emphasis)
- Secondary CTA: Engagement without commitment (demo)

---

#### 1.2 Video / Demo GIF Section

**Layout:** Centered, ~800px max-width, responsive

```
Headline: "Genera un piano in 3 step"

[Video/GIF — Autoplay, muted, audio optional]
Duration: 15-20 seconds
Content: Animated screen recording showing:
  1. Input phase: Select lavoratori, postazioni, copertura
  2. AI phase: Natural language "Marco domenica libera"
  3. Output phase: Grid fills, plan confirms, Excel exports

Subheader: "Dall'idea al piano in minuti.
           Niente fogli Excel, niente errori."
```

**Technical Spec:**
- Format: MP4 (video) or animated GIF (lighter, faster)
- Autoplay: Yes, muted by default
- Audio: Optional toggle (accessibility: captions if audio)
- Aspect ratio: 4:3 or 16:9 (desktop-friendly)
- Fallback: Static screenshot with play button if video fails

**Production Note:** Ideally screen-record the actual app (authentic) rather than custom animation (faster but less trustworthy).

---

#### 1.3 Problem + Solution (2-Column)

**Layout:** Two-column grid on desktop, stacked on mobile

```
┌──────────────────────┬──────────────────────┐
│      PROBLEM         │     SOLUTION         │
│                      │                      │
│ Headline:            │ Headline:            │
│ "Pianificazione      │ "Turni risolve tutto"│
│  manuale = caos"     │                      │
│ (dark text)          │ (green/blue text)    │
│                      │                      │
│ Bullets:             │ Bullets:             │
│ ❌ Errori, scoperte  │ ✅ AI analizza       │
│ ❌ Conflitti tra     │ ✅ Solver garantisce │
│    lavoratori        │    copertura 100%    │
│ ❌ Modifiche manuali │ ✅ Modifiche +       │
│ ❌ Ore su Excel      │    validazione       │
│                      │ ✅ Export auto       │
│                      │                      │
│ Icon/Image:          │ Icon/Image:          │
│ (confused grid,      │ (organized grid,     │
│  red X marks)        │  green check)        │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

**Copy — Problem Side:**
- ❌ Errori e scoperte dell'ultimo minuto
- ❌ Conflitti tra lavoratori che non accettano il turno
- ❌ Modifiche continue, niente traccia
- ❌ Ore spese in Excel + sincronizzazione manuale

**Copy — Solution Side:**
- ✅ AI estrae i vincoli dal linguaggio naturale italiano
- ✅ Solver deterministico garantisce copertura legale
- ✅ Modifiche interattive con validazione istantanea
- ✅ Export automatico in Excel e iCalendar

**Styling:** Subtle icons or emojis (not overdone). Generous spacing.

---

#### 1.4 Key Features (3 Cards)

**Layout:** 3-column grid on desktop, stack on mobile

```
Card 1: 🤖 AI in italiano
  "Estrai vincoli in 10 secondi"
  Brief description: AI understands Italian requests,
  converts to structured constraints, zero technical jargon needed.

Card 2: ⚙️ Solver deterministico
  "Garantisce copertura 100%, zero scoperte"
  Brief description: Deterministic algorithm, not heuristic.
  Coverage is verified before generation, failures explained.

Card 3: 📅 Intervalli flessibili
  "Da 1 giorno a 366 giorni"
  Brief description: Plan any date range, any duration.
  Cross-month/year boundaries, transactional consistency.
```

**Design:** Card layout — icon + title + 1-2 lines of copy. Color accents.

---

#### 1.5 Testimonials (2-3 Quotes)

**Layout:** Carousel or stacked cards (testimonial-card component)

```
Card 1:
⭐⭐⭐⭐⭐
"Prima passavo 8 ore a settimana su Excel.
 Ora il piano è pronto in 20 minuti. E senza errori."
— Marco R., HR Manager, PMI Veneto
[optional: logo/avatar]

Card 2:
⭐⭐⭐⭐⭐
"L'AI capisce subito cosa significa 'Marco domenica
 pomeriggio libera'. Non devo più scrivere per ore."
— Lucia B., Coordinatrice Turni, Lomellina
[optional: logo/avatar]

Card 3 (optional):
⭐⭐⭐⭐⭐
"Abbiamo ridotto gli errori di pianificazione del 90%.
 I lavoratori vedono i loro turni subito, niente sorprese."
— Franco M., Facility Manager, Piemonte
[optional: logo/avatar]
```

**Authenticity:** Testimonials must be real. If gathering real testimonials takes time, launch with placeholder copy that's generic but believable (avoid obviously fake names/situations).

---

#### 1.6 Final CTA + Newsletter (Optional)

**Layout:** Centered section

```
Headline: "Pronto a risolvere i turni?"
Subheader: "Accesso gratuito, niente carte.
           Setup in 10 minuti."

[Large primary button]
"Inizia gratis"

(Optional) Newsletter signup:
"Ricevi tips sulla pianificazione"
[Email input] [Iscriviti button]
```

**Copy Tone:** Action-oriented, low-friction (free, fast, no credit card).

---

#### 1.7 FAQ (Accordion)

**Layout:** Stacked accordion cards (expandable on click)

**Questions (4-5):**

1. **Q: Cos'è un "solver deterministico"?**
   A: Un algoritmo che costruisce la griglia garantendo copertura, monte ore, e riposi legali. A differenza di euristiche, il deterministic solver verifica che il risultato sia valido prima di presentarlo.

2. **Q: Come funziona l'AI?**
   A: Legge le richieste in italiano naturale (es. "Marco domenica pomeriggio libera") e le converte in vincoli strutturati che l'utente può confermare. Non genera direttamente i turni — solo valida i vincoli.

3. **Q: Posso modificare manualmente i turni?**
   A: Sì, griglia completamente interattiva. Ogni modifica è validata in tempo reale. Le celle modificate manualmente restano "bloccate" nelle rigenerazioni future.

4. **Q: Quanto costa?**
   A: Accesso gratuito per provare. Piano futuro: freemium per PMI fino a X lavoratori, pro tier per aziende più grandi. (Adjust as per pricing strategy)

5. **Q: I miei dati sono privati?**
   A: Sì, hosted on Supabase PostgreSQL in Italia. Nessuna terza parte. Pieno controllo dei vostri dati.

---

#### 1.8 Footer

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  [Links]                  [Social]                  │
│  Documentation          LinkedIn                    │
│  GitHub                 Email                       │
│  Contact us             Twitter (optional)          │
│                                                     │
│  Copyright © 2026 Turni. Privacy Policy.            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Design System

**Colors:**
- Primary: `#3B82F6` (blue, trust/professional)
- Success: `#10B981` (green, checkmarks)
- Text: `#1F2937` (dark grey, readable)
- Muted: `#6B7280` (lighter grey)
- Background: `#FFFFFF` (white)

**Typography:**
- Headline (h1): Bold, 48-56px desktop, 32-40px mobile
- Subheader (h2): Semi-bold, 28-36px desktop, 20-28px mobile
- Body (p): Regular, 16px, line-height 1.6
- Small (caption): 14px

**Spacing:** 
- Section padding: 80px vertical, 40px horizontal (desktop)
- Card gaps: 24px
- Element gaps: 16px

**Responsive:**
- Desktop (1200px+): Full 3-column layouts
- Tablet (768px–1199px): 2-column where applicable, stacked on smaller
- Mobile (<768px): Single column, stacked

---

## 2. AUTHENTICATED DASHBOARD (`/home` or `/dashboard`)

### Purpose
Post-login welcome screen & quick-access hub. Current behavior: redirect to current month's planning. New behavior: show a dashboard with:
- Quick stats (plans this month, hours covered, etc.)
- Quick links to main features
- Recent activity feed (optional)
- Shortcut to "Generate new plan"

### Architecture

```
┌─────────────────────────────────────────────────────┐
│ Header: Welcome back, [User name]!                  │
└─────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┐
│ Plans this   │ Hours this   │ Workers      │
│ month: 3     │ month: 240h  │ active: 15   │
└──────────────┴──────────────┴──────────────┘

┌──────────────────────────────────────────────────────┐
│ Quick Actions:                                       │
│ [Generate new plan]  [View current month]            │
│ [Manage workers]     [Manage positions]              │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Recent Activity:                                     │
│ • Plan for Aug 1-31 generated (2 days ago)          │
│ • Worker "Marco Rossi" added (1 week ago)           │
│ • Coverage updated for "Reception" (2 weeks ago)    │
└──────────────────────────────────────────────────────┘
```

### Components

**Header:** "Welcome back, [User name]"  
**Stats Row:** 3 cards showing key metrics  
**Quick Actions:** Buttons linking to main features  
**Recent Activity Feed:** Timeline of recent changes  

### Note on Implementation
Dashboard can be implemented as a new Next.js page (`app/home/page.tsx`) that fetches recent data from Supabase and displays it cleanly. Current redirect in `app/page.tsx` changes from:
```typescript
redirect(percorsoPianificazioneCorrente())
```
to:
```typescript
redirect('/home') // redirect to authenticated dashboard
```

And new auth logic in middleware ensures unauthenticated users see landing page, authenticated users see dashboard.

---

## 3. AUTHENTICATION FLOW

**Current state:** Users must manually promote to admin in DB.  
**Post-landing-page state:** 

1. Unauthenticated visitor → sees landing page (`/`)
2. Clicks "Inizia gratis" → redirected to sign up (`/accedi`)
3. Creates account → redirected to dashboard (`/home`)
4. Dashboard shows "setup required" or "create your first plan"

**Note:** This spec does not redesign the sign-up flow, only assumes it exists and lands users at `/home`.

---

## 4. TESTING & SUCCESS METRICS

### Success Criteria

- **Conversion:** Landing page → signup rate ≥ X%
- **Engagement:** Video plays, FAQ expands, CTA clicks track
- **Performance:** Landing page LCP < 2.5s, CLS < 0.1
- **Accessibility:** WCAG AA compliance (color contrast, keyboard nav, screen readers)

### Analytics to Track

- Landing page views
- CTA click-through rate (Inizia gratis vs. Guarda la demo)
- Video play rate + watch time
- FAQ accordion expansion rate
- Signup completion rate post-landing-page visit
- Time on page, scroll depth

---

## 5. DEPENDENCIES & ASSUMPTIONS

- **Authentication system exists** (Supabase auth with `accedi/` page)
- **Current redirect logic** can be updated (auth middleware)
- **Video/GIF asset** will be recorded from live app (not custom animated)
- **Testimonials** will be gathered from early users or seeded with realistic placeholders
- **Styling system** uses Tailwind or similar (consistent with existing app)

---

## 6. SCOPE & OUT OF SCOPE

### In Scope
✅ Landing page design & layout  
✅ Dashboard design & layout  
✅ Copy/messaging for all sections  
✅ Color/typography system  
✅ Responsive breakpoints  

### Out of Scope
❌ SEO optimization (meta tags, structured data) — handle separately  
❌ Advanced analytics/tracking setup — handle separately  
❌ Email newsletter backend — future phase  
❌ Pricing page or payment integration — future phase  
❌ Blog or content marketing — future phase  

---

## 7. IMPLEMENTATION PHASES

**Phase 1:** Landing page (`/`)  
- Build hero, video, problem+solution, features, testimonials, CTA, FAQ
- Basic styling + responsive
- Deploy to production

**Phase 2:** Authentication redirect logic  
- Update `app/page.tsx` to check auth status
- Redirect unauthenticated → `/` (landing)
- Redirect authenticated → `/home` (dashboard)

**Phase 3:** Dashboard (`/home`)  
- Build stats row, quick actions, activity feed
- Fetch recent data from Supabase
- Connect to existing features

---

## 8. FILE STRUCTURE (Tentative)

```
app/
  page.tsx                    → Redirect logic (auth check)
  (landing)/
    layout.tsx                → Landing page layout (no sidebar)
    page.tsx                  → Landing page content
    componenti/
      hero.tsx
      video-section.tsx
      problem-solution.tsx
      features-cards.tsx
      testimonials.tsx
      final-cta.tsx
      faq.tsx
      footer.tsx
  home/
    page.tsx                  → Dashboard
    componenti/
      welcome-header.tsx
      stats-row.tsx
      quick-actions.tsx
      activity-feed.tsx

public/
  landing-video.mp4           → Demo video
```

---

## 9. COLOR PALETTE (Reference)

| Role | Hex | Usage |
|------|-----|-------|
| Primary | `#3B82F6` | Buttons, links, accents |
| Success | `#10B981` | Checkmarks, confirmations |
| Text Dark | `#1F2937` | Headlines, body copy |
| Text Muted | `#6B7280` | Secondary text, captions |
| Border | `#E5E7EB` | Dividers, card borders |
| Background | `#FFFFFF` | Page background |
| Background Alt | `#F9FAFB` | Card backgrounds, sections |

---

## 10. NEXT STEPS

1. ✅ Design approved
2. → Create implementation plan (writing-plans skill)
3. → Build landing page components
4. → Record demo video
5. → Gather testimonials
6. → Test responsive design
7. → Deploy to production
8. → Monitor conversion metrics

---

**Document Status:** Ready for review  
**Last Updated:** 2026-08-01  
**Author:** AI (Brainstorming Skill)
