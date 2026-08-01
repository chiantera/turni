# AGENTS.md — Turni Project Instructions for AI Agents

This file contains instructions for AI agents, automation tools, and external AI providers working on the Turni project.

## Project Overview

**Turni** — Shift planning for n workers across m positions, with natural language AI assistant.

- **App:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Database:** Supabase PostgreSQL with RLS
- **AI:** Claude API (Anthropic) via MCP proxy
- **Core Logic:** Deterministic solver (not ML-based scheduling)

**Key principle:** AI proposes constraints (from natural language) → user confirms → solver decides (deterministically).

---

## Before You Start

1. **Read the README.md** — Understand the shift-planning model (7h/7h/10h cycle, 2:2:1 ratio, riposi minimi)
2. **Understand the architecture:**
   - Landing page: `app/(landing)/` — public, no auth
   - Dashboard: `app/(authenticated)/home/` — auth-guarded
   - Planning grid: `app/pianificazione/[mese]/` — main feature
   - AI layer: `lib/ai/` — Claude + DSL constraints
   - Solver: `lib/solver/` — three-phase deterministic algorithm
   - Data: `lib/dati/` — formatting, intervals, state management

3. **Check recent commits** (`git log --oneline -10`) to see what changed
4. **Run tests** (`npm test`) to baseline the project state
5. **Never push directly to main without confirmation** — ask first if unsure

---

## Code Style & Conventions

### Language
- **Project is Italian** — All UI copy, comments, documentation in Italian
- **Code is English** — Variable names, function names, class names in English
- **User-facing copy** — Always Italian (check `lib/landing/copy.ts` for examples)

### TypeScript
- **Strict mode:** All new code must pass `npm run typecheck` (no `any`, explicit types)
- **File structure:** Keep files focused (one responsibility per file)
- **Naming:** 
  - Components: PascalCase (`HeroSection.tsx`)
  - Utilities: camelCase (`formatDate.ts`)
  - Constants: UPPER_SNAKE_CASE (`COLORS`, `MAX_HOURS`)

### React & Next.js
- **Use App Router** (not Pages Router) — all routes in `app/`
- **Server Components by default** — only `"use client"` when needed (interactivity, hooks)
- **Avoid fetch in components** — move to Server Components or API routes
- **Route groups:** `(landing)`, `(authenticated)`, etc. for logical separation
- **Middleware:** Auth check in layout files, not separate middleware (simpler)

### Styling
- **Tailwind CSS only** — no inline styles, no CSS modules (unless Tailwind can't do it)
- **Mobile-first:** Design for mobile, then scale up (breakpoints: 768px, 1024px)
- **Accessibility:** 
  - Color contrast ≥ 4.5:1 (WCAG AA)
  - Semantic HTML (`<button>`, `<header>`, `<nav>`, etc.)
  - Keyboard navigation (Tab, Enter, Escape)
  - No `onclick` without `<button>`

### Git & Commits
- **Commit message format:**
  ```
  type: short summary (imperative, under 60 chars)
  
  Longer explanation if needed. Reference issues (#123).
  Keep it concise and focused on the "why".
  ```
  Types: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, `perf:`

- **One commit per logical unit** — not one giant commit per day
- **Never force-push main** — rebase locally if needed, but don't rewrite history
- **Tests must pass before pushing** — `npm test` should be green

---

## Common Tasks

### Adding a New Feature
1. Create a branch (or ask if main is okay)
2. Add the feature in the appropriate directory
3. Write tests if adding logic (not required for UI-only changes)
4. Run `npm test` and `npm run typecheck`
5. Test in browser if UI-related
6. Commit with clear message
7. Push and (if not main) request review

### Fixing a Bug
1. Understand the bug: reproduce it, find the root cause
2. Fix the root cause, not the symptom
3. Add a test if possible (to prevent regression)
4. Commit with clear message explaining the fix
5. Reference the issue if one exists

### Writing Tests
- **Use Vitest** (`npm test`) — framework is Vitest
- **Integration tests** — for complex logic (solver, AI extraction)
- **Unit tests** — for utility functions (formatDate, validateCoverage)
- **No E2E tests yet** — manual browser testing for now
- Test file naming: `*.test.ts` or `*.itest.ts` (integration)

### Updating Documentation
- **README.md** — High-level overview, getting started, architecture
- **HANDOFF.md** — When a feature is complete, add testing & TODO notes
- **In-code comments** — Only for "why", not "what" (code should be self-documenting)
- **Docs folder** — Technical deep-dives live here (e.g., `docs/landing-page.md`)

---

## Critical Constraints

### Database
- **Supabase PostgreSQL** — RLS is active, respect row-level security
- **Migrations:** Always write migrations for schema changes (in `supabase/migrations/`)
- **No direct SQL in components** — use Supabase client or RPC functions
- **Transactional:** Many operations use PostgreSQL RPCs for atomicity (planning runs, reductions)

### AI Integration
- **Claude API only** — no other providers (unless explicitly changed)
- **MCP proxy:** Requests go through `proxy.ts` (do not bypass)
- **API keys:** Never commit `.env` files, use environment variables
- **Streaming:** Supported via Next.js Route Handlers (use if needed)
- **Cost:** Be mindful of token usage in production

### Solver & Planning
- **Deterministic, not heuristic** — Results must be reproducible (same seed = same output)
- **Hard constraints, not penalties** — Feasibility is binary (coverage or don't)
- **Planning run:** Atomic unit (dal/al dates, versioning, rollback on conflict)
- **No manual override of solver validation** — if solver says "impossible", tell user why

### Auth & Security
- **Supabase Auth** — Use the built-in session management
- **Server-side checks:** Always verify session in Server Components before showing data
- **RLS policies:** Database enforces access control (admin, pianificatore, lavoratore roles)
- **No secrets in logs** — Be careful with error messages, don't leak API keys

---

## File Locations & Patterns

### Where to put things:
- **UI Components:** `app/*/componenti/` (lowercase c)
- **Page components:** `app/*/page.tsx`
- **API routes:** `app/api/*/route.ts`
- **Utility functions:** `lib/dati/`, `lib/ai/`, `lib/solver/`
- **Shared constants:** `lib/landing/constants.ts`, `lib/dati/constants.ts`, etc.
- **Type definitions:** `lib/supabase/types.ts` (generated from Supabase), or inline if small
- **Tests:** `*.test.ts` or `*.itest.ts` (same directory as code)

### Naming conventions:
- **Directories:** snake_case or hyphenated (e.g., `landing-page`, `shift-planning`)
- **Components:** PascalCase (e.g., `HeroSection.tsx`, `SelettoreIntervallo.tsx`)
- **Utilities:** camelCase (e.g., `formatDate.ts`, `validateCoverture.ts`)
- **Constants files:** `constants.ts`, `copy.ts`, `config.ts`

---

## Common Pitfalls to Avoid

❌ **Don't:**
- Commit `.env` files or any secrets
- Use `eval()` or dynamic imports without good reason
- Fetch data in Client Components (causes hydration errors)
- Ignore TypeScript errors (fix them, don't use `any`)
- Skip the solver's validation (it's there for a reason)
- Make UI decisions without considering mobile (responsive first!)
- Assume all users have fast networks (test on slow 3G)
- Hardcode magic numbers (use constants)

✅ **Do:**
- Run tests before pushing
- Keep commits small and focused
- Write clear commit messages
- Test in browser if you touch UI
- Ask before making big changes
- Update docs when adding features
- Use semantic HTML for accessibility
- Handle errors gracefully (show user-facing messages, not stack traces)

---

## Useful Commands

```bash
# Development
npm run dev                    # Start dev server (port 3000 or next available)
npm test                       # Run test suite (Vitest)
npm run typecheck             # TypeScript checking
npm run lint                  # ESLint

# Building
npm run build                 # Production build
npm run start                 # Start production server (after build)

# Database (Supabase local)
supabase start                # Start local Postgres + studio
supabase migration list       # See all migrations
supabase db reset             # Reset local DB to latest migration

# Debugging
AI_DEBUG=1 npm run test:ai    # See raw AI requests/responses
```

---

## When You're Stuck

1. **Check the README** — It covers most architectural decisions
2. **Look at recent commits** — See what changed and how
3. **Read test files** — They often document expected behavior
4. **Ask in code comments** — If something is unclear, ask
5. **Run the app locally** — Reproduce the issue before fixing
6. **Check git blame** — Understand why a line exists

---

## Handing Off Work

When you complete a feature or fix:

1. **Write a brief summary** in the commit message (the "why")
2. **Add a TODO comment** if follow-up work is needed
3. **Update HANDOFF.md** if it's a major feature (testing, next steps)
4. **Run full test suite** (`npm test`) before pushing
5. **Push to main or create PR** (ask if unsure which)
6. **Link any issues** closed by your work

---

## Questions?

- **Architecture questions:** See `README.md` → "Architettura"
- **Feature documentation:** Check `docs/` folder
- **Recent work:** Look at `HANDOFF.md` for latest features
- **Design specs:** `docs/superpowers/specs/` has full design docs
- **Implementation plans:** `docs/superpowers/plans/` has step-by-step guides

---

**Last updated:** 2026-08-01  
**Maintained by:** Claude Code + AI Agents  
**Language:** Italian (UI/docs) + English (code)
