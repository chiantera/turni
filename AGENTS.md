# AGENTS.md — Turni Project Instructions for AI Agents

This file contains instructions for AI agents, automation tools, and external AI providers working on the Turni project.

## Project Overview

**Turni** — Shift planning for n workers across m positions, with natural language AI assistant.

- **App:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Database:** Supabase PostgreSQL with RLS
- **AI:** provider intercambiabile via `AI_PROVIDER` (oggi Mistral) — `lib/ai/provider.ts`
- **Core Logic:** Deterministic solver (not ML-based scheduling)

**Key principle:** AI proposes constraints (from natural language) → user confirms → solver decides (deterministically).

---

## Environments and links

| What | Where |
|---|---|
| **Production** | https://turni-psi.vercel.app |
| Privacy / data handling | https://turni-psi.vercel.app/privacy |
| Sign in | https://turni-psi.vercel.app/accedi |
| Dashboard (needs a session) | https://turni-psi.vercel.app/home |
| Vercel project | https://vercel.com/chiantera-5967s-projects/turni |
| Supabase project `uxwmletpnmsbvdyxktln` | https://supabase.com/dashboard/project/uxwmletpnmsbvdyxktln |
| Repository | https://github.com/chiantera/turni |
| CI and smoke test | https://github.com/chiantera/turni/actions |

Equivalent aliases of the same production deployment:
`turni-chiantera-5967s-projects.vercel.app`,
`turni-git-main-chiantera-5967s-projects.vercel.app`.

**Deployment is automatic.** Every push to `main` builds and publishes; there
is no staging environment. What you push is what beta testers see. Treat a
push to `main` as a release, and verify the running system afterwards —
`scripts/verifica-produzione.sh` runs on its own after each successful deploy,
but run it by hand too when you touch the landing page or the middleware.

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
5. **Read "Verified Traps" below.** Every entry is a defect that already
   shipped here. Compiling clean is not the same as working — see
   `./scripts/verifica-produzione.sh`.
6. **Never push directly to main without confirmation** — ask first if unsure

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
- **Middleware:** auth and public routes live in `proxy.ts`, not in layouts.
  It intercepts API routes too — a public endpoint must be allowlisted there.

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
- **No E2E tests yet.** `scripts/verifica-produzione.sh` covers what a browser
  test would catch from outside: status codes, assets, content invariants.
- Test file naming: `*.test.ts` or `*.itest.ts` (integration)

### Updating Documentation
Use the `documentazione` skill (`.claude/skills/documentazione/`): it holds the
criteria for what is worth recording and where it belongs. In short — `AGENTS.md`
for durable rules, `HANDOFF.md` for the state of the work, `README.md` for the
structure map, and nothing at all for what git or the code already says.

---

## Critical Constraints

### Database
- **Supabase PostgreSQL** — RLS is active, respect row-level security
- **Migrations:** Always write migrations for schema changes (in `supabase/migrations/`)
- **No direct SQL in components** — use Supabase client or RPC functions
- **Transactional:** Many operations use PostgreSQL RPCs for atomicity (planning runs, reductions)

### AI Integration
- **Provider is a single env var** — `AI_PROVIDER`, resolved in `lib/ai/provider.ts`.
  Today it is `mistral`, chosen because the prompt carries workers' full names
  and Mistral is in the EU. Changing it must not require touching any other file.
- **`proxy.ts` is the auth middleware, not an AI proxy.** It has nothing to do
  with this section; it decides which routes are public.
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

## Verified Traps

Every item below already cost real time on this project. They are not
hypotheses — each one is a defect that shipped, or nearly did.

### Compiling is not working

On 1-2 August 2026 the following were all true at once, with typecheck clean,
lint passing and every test green: the landing page was unreachable (the
middleware redirected `/` to the login), `.mp4` requests returned 307, both
video assets were 0 bytes, the production database was two migrations behind
the deployed code, and the page carried fabricated customer testimonials.

**None of it was visible in the source.** Run the smoke test against the
deployed system:

```bash
./scripts/verifica-produzione.sh                        # produzione
./scripts/verifica-produzione.sh http://localhost:3000  # locale
```

Every assertion in that script is tied to a real incident, and says which.
Keep it that way: assertions added "just in case" turn into false failures
that get ignored, which is how a check stops being a check.

### The migration ledger is not the schema

`list_migrations` reports only what was applied through the CLI or the MCP. It
says nothing about the schema that actually exists — read `information_schema`
for that. The two diverge in both directions: as of 2 August 2026 the remote
holds three migrations whose SQL is nowhere in this repo
(`copertura_festiva_esplicita`, `dati_dimostrativi`, `primo_utente_admin`), so
**the repository cannot currently rebuild production from scratch.**

### RLS policy syntax: `FOR` before `TO`

```sql
create policy "x" on t for select to authenticated using (...);  -- valido
create policy "x" on t to authenticated for select using (...);  -- rifiutato
```

Written the wrong way round the migration is not applicable at all. This is
why `planning_runs` sat unapplied for days while `/riepilogo`,
`/pianificazione`, plan generation and `/home` were broken in production.

### The middleware guards API routes too

`proxy.ts` intercepts `/api/*` exactly as it intercepts pages. A public
endpoint must be added to the allowlist explicitly — "public route" is easy to
read as "page you visit" and forget that it also means "endpoint you call".
Static assets need their **file extension** in the matcher exclusion list;
`mp4` was missing, so no video could ever be served.

### Do not duplicate RLS in TypeScript

Queries in `lib/dati/` deliberately carry no per-user filter: the policies do
it, so the same code returns totals to a `pianificatore` and only their own
rows to a `lavoratore`. A copy of that rule in TypeScript is the copy that
eventually drifts from the one in the database.

### Read the right exit code

`npm run build 2>&1 | tail -20` returns **tail's** status, so a failed build
reports 0. Write to a file and read `$?`:

```bash
npm run build > /tmp/build.log 2>&1; echo "exit=$?"; tail -20 /tmp/build.log
```

Conversely `grep -c` exits 1 when it finds nothing, which is often the desired
result. Know whose exit code you are reading.

### Local environment

- `.next/dev/types` goes stale after a route is deleted and makes
  `npm run typecheck` fail on a file that no longer exists.
  Fix: `rm -rf .next/dev/types`
- The executable bit does not survive on `/mnt/c` under WSL. `chmod +x` will
  not reach the git index — use `git update-index --chmod=+x <file>`, or CI
  fails with "permission denied" on a script that runs fine locally.
- `npm run lint` takes over four minutes here. That is precisely why CI exists:
  a check that slow stops being run, and the lint was red on `main` for days.

### `settings.ai` looks authoritative and is not

The `settings` table holds a row `{"chiave": "ai", "valore": {"provider":
"glm", "modello": null}}`. Changing the AI provider, it is the first thing you
find and the natural thing to update. **Nothing reads it on the extraction
path.** `Assistente.tsx` posts only `{ testo, mese }`, so `corpo.provider` is
null and `ottieniModello()` falls through to `process.env.AI_PROVIDER`. The row
is written by `/impostazioni` and consumed only by the ad-hoc test widget there.

Changing the provider means changing the env var — in `.env.local` **and** on
Vercel, which is the one that governs production.

### Vercel environment variables

`vercel env add` ignores stdin when it detects an agent (non-interactive mode)
and silently stores an empty string. Use `--value`. New Production variables
also default to **sensitive**, meaning write-only: `vercel env pull` returns an
empty string and you cannot verify what you set. Pass `--no-sensitive` for
configuration that is not a secret, such as `AI_PROVIDER`.

### Public copy must survive contact with the code

The landing page claimed "Nessuna terza parte" while `lib/ai/estrazione.ts`
sent every worker's name to an AI provider; it promised "zero scoperte" while
the solver counts uncovered shifts; it linked a mailbox on a domain with no MX
record. Before shipping copy, check each claim against what the code does.
Never publish testimonials, reviews or endorsements that were not given by a
real person.

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

# Verifica del sistema in esecuzione (non del sorgente)
./scripts/verifica-produzione.sh                        # smoke test in produzione
./scripts/verifica-produzione.sh http://localhost:3000  # contro il locale
./scripts/demo-landing/genera.sh                        # rigenera il video demo
```

**CI runs on every push** (`.github/workflows/ci.yml`): typecheck, lint, test,
build — each step runs even if the previous one fails. The smoke test runs
after every successful deploy and once a day
(`.github/workflows/verifica-produzione.yml`); the daily run also catches a
free-tier Supabase project going to sleep, which stops the app without anyone
touching the code.

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

**Last updated:** 2026-08-02  
**Maintained by:** Claude Code + AI Agents  
**Language:** Italian (UI/docs) + English (code)
