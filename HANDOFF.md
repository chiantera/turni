# Landing Page & Dashboard — Implementation Handoff

**Date:** 2026-08-01  
**Status:** ✅ Complete & Pushed to `origin/main`  
**Commits:** 5 commits on main (design spec → implementation → assets → fallback)

---

## What Was Built

### 🌐 Public Landing Page (`/`)

A conversion-focused landing page with 8 sections (all Italian, HR-targeted):

1. **Hero Section** — Gradient background, split headline "Turni complessi? / Risolvi in minuti, non ore.", subheader, dual CTA buttons (Inizia gratis / Guarda la demo)
2. **Video Section** — Autoplay muted demo video (15-20s), fallback screenshot, smooth scroll-to-from hero CTA
3. **Problem + Solution** — 2-column grid (left: chaotic manual planning, right: Turni solves it)
4. **Features (3 Cards)** — AI in italiano, Solver deterministico, Intervalli flessibili
5. **BetaNotice** — Stato onesto del prodotto: cosa è pronto, cosa manca
6. **Final CTA** — "Pronto a risolvere i turni?" + iscrizione newsletter (collegata a Supabase)
7. **FAQ** — 5 accordion items (what is solver, how AI works, manual edits, pricing, privacy)
8. **Footer** — Dark background. Solo link verificati: README e issue su GitHub, pagina Trattamento dei dati

**Tech:**
- Next.js App Router group route `(landing)/`
- All copy centralized in `lib/landing/copy.ts`
- Design constants in `lib/landing/constants.ts` (colors, breakpoints, spacing)
- Responsive (mobile-first): 375px, 768px, 1024px+
- WCAG AA accessibility ready (semantic HTML, color contrast, keyboard nav)
- Tailwind CSS

---

### 📊 Authenticated Dashboard (`/home`)

Post-login hub with quick access to planning features:

1. **Welcome Header** — Personalized greeting "Bentornato, [User name]! 👋"
2. **Stats Row** — 3 KPI cards da query reali: piani del mese, ore del mese, lavoratori attivi
3. **Quick Actions** — 4 scorciatoie: pianifica questo mese, pianifica il mese prossimo, gestisci lavoratori, gestisci postazioni.
   I percorsi arrivano dal server: puntavano a `/pianificazione` senza mese, che non è una rotta e dava 404.
4. **Activity Feed** — Cronologia reale: piani generati o aggiornati, lavoratori e postazioni aggiunti

**Tech:**
- Next.js App Router route `(authenticated)/home/`
- Server-side rendering (gets user from session)
- Auth guard: redirects unauthenticated users to landing page
- Stats e activity feed da Supabase (`lib/dati/statistiche.ts`, `lib/dati/attivita.ts`)
- Same responsive/accessibility standards as landing page

---

### 🔐 Auth Routing

Lo smistamento sta tutto in **`proxy.ts`** (il middleware), non in una pagina:

- `/`, `/privacy`, `/api/newsletter`, `/accedi` e `/auth` sono pubbliche; ogni
  altro percorso senza sessione finisce su `/accedi?da=<percorso>`
- con una sessione attiva, `/` e `/accedi` rimandano a `/home`

I route group **non** creano segmenti di URL: `(landing)/page.tsx` risponde su
`/`. Per questo non può esistere anche un `app/page.tsx` — le due pagine
risolverebbero lo stesso percorso. La separazione pubblico/protetto la fa il
middleware; i gruppi servono solo a dare layout diversi.

**Route groups:**
- `(landing)` — Public, no sidebar
- `(authenticated)` — Protected, has sidebar (existing layout)

---

## File Structure

```
proxy.ts                            → Middleware: rotte pubbliche e redirect

app/
  (landing)/
    layout.tsx                      → Landing layout (no sidebar)
    page.tsx                        → Compose all 8 sections (risponde su "/")
    componenti/
      HeroSection.tsx
      VideoSection.tsx
      ProblemSolution.tsx
      FeaturesCards.tsx
      BetaNotice.tsx
      FinalCTA.tsx
      FAQ.tsx
      Footer.tsx
  (authenticated)/
    layout.tsx                      → Auth guard + existing sidebar
    home/
      page.tsx                      → Dashboard
      componenti/
        WelcomeHeader.tsx
        StatsRow.tsx
        QuickActions.tsx
        ActivityFeed.tsx

lib/
  landing/
    copy.ts                         → All Italian copy strings
    constants.ts                    → Colors, breakpoints, spacing, typography

public/
  landing-demo.mp4                  → Animazione sintetica 15s (da sostituire)
  landing-demo-fallback.png         → Poster del video

scripts/
  verifica-produzione.sh            → Smoke test anonimo sul sito in linea
  demo-landing/
    fotogrammi.html                 → Stato del fotogramma N via ?f=N
    genera.sh                       → Rende i fotogrammi e codifica l'mp4

e2e/
  autenticato.spec.ts               → Playwright: le pagine dietro il login
playwright.config.ts                → Punta a BASE_URL, default produzione
```

---

## How to Test

### 1. Start Dev Server
```bash
npm run dev
# Opens on http://localhost:3000 (or next available port)
```

### 2. Test Landing Page (Unauthenticated)
- Navigate to `http://localhost:3000/`
- Should see full landing page with all 8 sections
- Click "Inizia gratis" → should redirect to `/accedi?action=signup`
- Click "Guarda la demo" → should smooth-scroll to video section
- Scroll through all sections, verify text/images load
- Test FAQ accordion (click to expand/collapse)
- Iscrizione newsletter: richiede la migrazione applicata, altrimenti risponde 500
- Test footer links

### 3. Test Dashboard (Authenticated)
1. Sign up or log in via `/accedi`
2. After login, should auto-redirect to `/home`
3. Dashboard should display:
   - Welcome header with your name
   - Stats row con i dati reali del mese corrente
   - Quick action buttons linking to main features
   - Activity feed con la cronologia reale (vuoto se il database è vuoto)
4. Click quick action buttons → should navigate to respective pages

### 4. Test Responsive Design
Use browser DevTools to resize or emulate:
- **Mobile (375px)** — Hero text readable, buttons stack, all text legible
- **Tablet (768px)** — 2-column layouts appear, grids adjust
- **Desktop (1024px+)** — 3-column grids, full width utilized

### 5. Test Accessibility
- **Keyboard nav:** Tab through all buttons/links, Enter to activate
- **Color contrast:** Use DevTools Lighthouse or axe DevTools (should be ≥ 4.5:1)
- **Screen reader:** Test with VoiceOver (Mac) or NVDA (Windows)

---

## Verifiche automatiche

Due workflow, con due bersagli diversi.

**`.github/workflows/ci.yml`** — su ogni push e pull request esegue tipi, lint,
test e build. Ogni passo gira anche se il precedente fallisce, così un giro
solo dice tutto quello che è rotto. Esiste perché il lint è rimasto rosso su
`main` per giorni: in locale impiega oltre quattro minuti, e una verifica lenta
smette di essere eseguita.

**`.github/workflows/verifica-produzione.yml`** — dopo ogni deploy riuscito, su
richiesta, e una volta al giorno alle 07:00 UTC. Lancia
`scripts/verifica-produzione.sh`, che interroga il sito in linea.

Il giro giornaliero non è ridondante: i progetti Supabase del piano gratuito
vanno in pausa dopo un periodo di inattività — tre degli altri progetti
dell'organizzazione sono già `INACTIVE` — e un database in pausa spegne
l'applicazione senza che nessuno abbia toccato una riga di codice.

### Il punto cieco: scritto, non ancora attivo

Lo smoke test in bash interroga il sito da anonimo, e per un anonimo **ogni
pagina protetta risponde 307 verso il login** — sana o rotta che sia. Entrambi
i difetti del 2 agosto 2026 stavano lì dietro: `/home` che rispondeva 500 e
`/pianificazione` che dava 404. I 17 controlli li vedevano perfetti.

`e2e/autenticato.spec.ts` (Playwright) entra davvero: fa login e apre
dashboard, pianificazione e riepilogo, verificando che non siano pagine di
errore e che non producano errori JavaScript.

> **⚠️ Manca un passo manuale: finché non lo si fa, questi test non girano.**
> Dal 3 al 4 agosto 2026 il job `autenticato` ha chiuso in verde a ogni run
> senza eseguire nulla — «5 skipped». Ora un run non configurato appare grigio
> «skipped» con un avviso, invece che verde.

**Servono due secret su GitHub** (Settings → Secrets and variables → Actions):
`SMOKE_EMAIL` e `SMOKE_PASSWORD`. L'account va creato dal pannello Supabase —
Authentication → Users → Add user, con **Auto Confirm** — e lasciato al ruolo
predefinito `lavoratore`: RLS gli impedisce di scrivere qualsiasi cosa, quindi
le credenziali in CI non sono un rischio di modifica dei dati.

```bash
gh secret set SMOKE_EMAIL --body "..."      # dopo aver creato l'utente
gh secret set SMOKE_PASSWORD --body "..."
gh workflow run "Verifica produzione"       # per verificare subito
```

```bash
SMOKE_EMAIL=... SMOKE_PASSWORD=... npm run test:e2e
```

Lo smoke test si può lanciare anche a mano, contro qualunque ambiente:

```bash
./scripts/verifica-produzione.sh                          # produzione
./scripts/verifica-produzione.sh http://localhost:3000    # locale
```

**Ogni controllo corrisponde a un guasto realmente accaduto**, ed è annotato con
quale. Aggiungendone uno, va aggiunta anche la riga che spiega cosa è successo:
serve a distinguere gli invarianti veri dalle asserzioni difensive scritte per
abitudine.

---

## Il fornitore AI (cambiato il 2 agosto 2026)

`AI_PROVIDER` è passato da `glm` a **`mistral`**, in locale e su Vercel.

**Perché.** `lib/ai/estrazione.ts:66` costruisce il prompt inserendovi nome e
cognome di ogni lavoratore, e li inviava a `api.z.ai` (Zhipu, Cina). Con dei
beta tester che caricano dipendenti veri, era un trasferimento extra-UE di dati
personali di persone che non hanno scelto di usare Turni. Mistral è francese.

**Cosa costa.** `glm-4.7-flash` stava nel piano gratuito;
`mistral-large-latest` si paga a token. Se serve contenere,
`mistral-small-latest` è già fra i modelli noti in `provider.ts` e per tradurre
una frase in un vincolo è probabilmente sufficiente.

**Verificato.** `npm run test:ai` — 6 test di integrazione su 6 con chiamate
reali, circa 10 secondi a richiesta contro i ~5 di GLM Flash.

**La riga `settings.ai` nel database dice ancora `glm`, ed è irrilevante.**
Vedi la trappola omonima in `AGENTS.md`: quel valore non viene letto dal
percorso di estrazione. Non allinearla non è una svista.

---

## Il disallineamento del database (risolto il 2 agosto 2026)

Per giorni il database di produzione è stato indietro di due migrazioni rispetto
al codice distribuito. Mancavano `planning_runs`, `schedules.planning_run_id`, le
RPC `salva_piano_intervallo`, `salva_modifiche_intervallo` e
`applica_riduzione_ore`, e i valori `disciplinare` e `studio` di `tipo_assenza`.
Di conseguenza `/riepilogo`, `/pianificazione`, la generazione dei piani e — dopo
il collegamento dell'activity feed — anche `/home` rispondevano con un errore.

**La causa non era una dimenticanza.** `20260730000001_planning_runs.sql`
conteneva un errore di sintassi: le due policy erano scritte
`to authenticated for select`, mentre PostgreSQL richiede `for select to
authenticated`. Quella migrazione non era mai stata applicabile. Corretta e
applicata; il backfill ha creato 5 run per i 5 schedules esistenti, senza
toccare le 2309 assegnazioni.

**Cosa impararne:** il registro delle migrazioni (`list_migrations`) elenca solo
ciò che è passato dal CLI o dall'MCP. Non dice nulla dello schema reale, che va
letto da `information_schema`. Le due cose possono divergere in entrambe le
direzioni — sul remoto esistono tre migrazioni (`copertura_festiva_esplicita`,
`dati_dimostrativi`, `primo_utente_admin`) il cui SQL non è nel repository, il
che significa che oggi il repo **non è in grado di ricostruire la produzione da
zero**. Vale la pena recuperare quel SQL prima che serva davvero.

---

## Incidente del 4-9 agosto 2026: 135 milioni di transazioni abortite

**Chiuso il 9 agosto 2026.** Le RPC del piano segnalavano cinque regole di
dominio permanenti con `errcode = '40001'` (`serialization_failure`), che
significa «riprova». Qualcuno ha riprovato per cinque giorni a 357 al secondo.

- **Rilevato da:** `pg_stat_database.xact_rollback` — 135.409.553 rollback
  contro 498.542 commit. `pg_stat_statements` mostrava 3 chiamate, perché non
  registra le istruzioni che sollevano eccezioni.
- **Corretto da:** `supabase/migrations/20260809000001_errcode_non_ritentabile.sql`,
  applicata in produzione il 9 agosto. `40001` → `P0001` in sette punti.
- **Verificato:** contatore dei rollback fermo, invariato su una finestra di
  sette minuti, mentre i commit continuavano a salire. Cambiare lo SQLSTATE ha
  spento il ciclo da solo — la conferma che chi ritentava leggeva quel codice.
- **Aggiunto:** `lib/dati/errori-piano.ts` traduce i nomi simbolici in risposte
  HTTP, al posto della mappatura duplicata nei due route handler. L'utente ora
  legge «una cella è bloccata» invece di «il piano è cambiato».

> **Non chiuso:** *chi* mandava le richieste. Il ritmo costante senza backoff
> non corrisponde ai ritentativi di `supabase-js`. Non è più urgente — con
> `P0001` nessuno ricomincia — ma resta un client ignoto da identificare dai log
> del gateway.

## La generazione del piano non ha mai funzionato (30 luglio – 14 agosto 2026)

**Chiuso il 14 agosto 2026.** «Genera il piano» rispondeva sempre
`column reference "mese" is ambiguous`.

- **Causa:** `salva_piano_intervallo` dichiarava una variabile plpgsql `mese`;
  `schedules` ha una colonna `mese`. La clausola `on conflict (planning_run_id,
  mese)` nomina colonne della tabella di destinazione, quindi entrambi i
  candidati erano vivi e Postgres si è rifiutato di scegliere (SQLSTATE 42702).
  La lista `values` accanto, con lo stesso nome, era invece innocua: lì le
  colonne della destinazione non sono in scope.
- **Perché è passata inosservata due settimane:** plpgsql compila l'SQL alla
  prima esecuzione, non a `create function`. La migrazione si è applicata
  pulita, il registro la dava verde, typecheck e test non la vedono nemmeno.
- **Prova che non ha mai funzionato:** le 5 righe in `schedules` e le 2309
  assegnazioni portano tutte lo stesso `aggiornato_il` (30 luglio 2026,
  01:14:19) — sono il seed dimostrativo. La funzione inserisce un run per
  chiamata: non è mai andata a buon fine nemmeno una volta.
- **Riprodotto** su un clone strutturale di `schedules` (`create temp table
  ... like schedules including all`), con l'errore identico a quello di
  produzione, e risolto sullo stesso clone rinominando la variabile in
  `v_mese`, verificando anche il ramo `do update`.
- **Corretto da:** `supabase/migrations/20260814000001_mese_ambiguo.sql`,
  applicata in produzione il 14 agosto 2026. Verificata rileggendo `pg_proc`:
  la funzione installata dichiara `v_mese`, zero occorrenze residue di `mese`.
- **Verificato per intero:** il corpo della funzione è stato eseguito su cloni
  temporanei di tutte e quattro le tabelle (`create temp table ... like ...
  including all`, che `pg_temp` antepone a `public`), su un intervallo di due
  mesi e per due volte di fila. La rigenerazione lascia 2 piani, 3 assegnazioni
  e 2 violazioni — non 4, 6 e 4 — con `versione` da 1 a 2 e `seed` da 42 a 99:
  gli upsert su `schedules` e `assignments`, il `delete`+`insert` delle
  violazioni e il ramo `primo_mese` per le violazioni senza data funzionano
  tutti. Dietro l'ambiguità non c'era un secondo difetto.
- **Regressione:** `lib/supabase/ambiguita-plpgsql.test.ts` controlla la
  definizione *finale* di ogni funzione — le migrazioni applicate sono storia e
  non si riscrivono, conta lo stato in cui il database finisce.

> **La lezione più larga:** nessun test in questo repository esegue una RPC.
> Le funzioni in `supabase/migrations/` sono codice che al massimo viene
> analizzato sintatticamente. Finché uno smoke test autenticato non genera
> davvero un piano, un difetto come questo può restare in produzione
> indefinitamente con tutti i controlli verdi — che è precisamente il TODO 🔴
> qui sotto.

## Equità delle ore fra lavoratori (14 agosto 2026)

Richiesta: appianare le ore lavorate per periodo, a meno che non ci sia una
buona ragione per uno squilibrio. Periodo = l'intero intervallo del piano;
il bilanciamento è una preferenza fra candidati ammissibili, mai un vincolo.

**Cosa non era il problema.** `costoLavoratore()` tira già ognuno verso il
proprio monte ore contrattuale, settimana per settimana, con peso 100. E le
fasi costruttive da sole lasciano due persone a zero ore su nove — ma la
ricerca locale lo ripara entro 1,5 s, e la produzione usa 10 s.

**Cosa era.** `costoEquita()`, l'unico termine che confronta i lavoratori fra
loro, pesava 20 contro 100, e misurava le ore **assolute** invece dello scarto
dal contratto.

**Cosa è cambiato.**

1. `costoEquita()` misura ora il residuo `ore − target`. Nota bene: a contratti
   uguali questo è un no-op, perché la deviazione standard è invariante per
   traslazione. Serve solo a contratti misti, dove riduce la dispersione media
   dei residui da 17,9 h a 11,2 h.
2. La fase greedy sceglie fra i candidati ammissibili chi è più indietro
   rispetto al proprio contratto, invece di rompere i pareggi a caso. O(1) per
   candidato, con un contatore incrementale.
3. `equita_ore` da 20 a **100**, alla pari con `ore_target` — la modifica che
   sposta davvero il numero. **Cambiata sia in `PESI_DEFAULT` sia nella riga
   `settings.pesi` in produzione**: quella riga elenca ogni chiave esplicita e
   scavalca il default, quindi il solo codice non avrebbe fatto nulla.

**Misure** (15 piani: 7..14 lavoratori × 3 semi, budget di produzione):

| | dispersione ore | dispersione notti | scoperte |
|---|---|---|---|
| `equita_ore` 20 | 7,20 h | 2,13 | 0 |
| `equita_ore` 100 | **5,73 h** | 2,47 | 0 |

Il costo è dichiarato: circa 0,3 notti di dispersione in più. Notti e ore non
si appianano entrambe al massimo. Si torna indietro dallo slider in
`/impostazioni`, senza toccare il codice.

**Test:** `lib/solver/equita.test.ts`, con budget in *iterazioni* e non in
millisecondi (è l'unico modo perché la ricerca locale sia riproducibile). La
soglia è 8 h: col peso vecchio la dispersione arrivava a 11 h, col nuovo resta
a 7 h — il test può fallire, ed è il motivo per cui vale qualcosa.

## Configurazione reale al posto dei dati dimostrativi (18 agosto 2026)

I dati finti («Marco Rossi», «Reparto A») sono stati cancellati e sostituiti con
la configurazione vera del servizio, letta dai prospetti in `turni_dati/`.

**I nominativi stanno solo nel database, mai nel repository.** Questo repository
è pubblico: i cognomi di 28 dipendenti di una cooperativa identificabile non
possono finire in un file di migrazione. Chi ricostruisce l'ambiente da zero
trova quindi lo schema ma non l'anagrafica — è voluto.

- **2 postazioni:** Stradora (C.S.R.R. residenziale) e Il Bruco.
- **18 sigle di turno**, con durate reali da 4,5 h a 11,5 h: `Ma Mb Mc Md Me Mf`
  e `MAP` al mattino, `Pa Pb Pc Pd Pe Pf` e `AP` al pomeriggio, `N1 N2 N` la
  notte, più `PRG`. `MAP` e `AP` appartengono a Il Bruco, il resto a Stradora.
- **29 operatori**, 28 attivi più un tirocinante disattivato per non contarlo
  nella copertura. Solo cognome: inventare un nome di battesimo sarebbe stato
  peggio di lasciarlo vuoto. Le grafie non sono verificate.
- **126 regole di copertura**, dedotte dalla legenda. Il prospetto di agosto le
  ha poi smentite su due sigle: vedi «La copertura letta da un mese vero» qui
  sotto. Il numero da citare è 745 h/settimana, non 917.

### Tre cose da chiarire col coordinatore

- **`Mb` e `Md` hanno durate incoerenti nella legenda**: entrambe date 7,5 h, ma
  7:00→14:00 e 7:30→14:30 sono 7 h. Inserite come 7 h, perché `durata_min` non
  serve solo a contare le ore: `modello.ts` ne ricava l'ora di fine con
  `inizioMin + durataMin`, e da quella dipendono i riposi minimi. Sbagliarla
  falserebbe un vincolo di sicurezza, non un conteggio.
- **`PRG` compare due volte** nella legenda, identica in mattino e pomeriggio
  (8:00–14:00). La legenda del prospetto però parla di «8:00–14:00 **o**
  14:00–20:00»: se la variante pomeridiana si usa, serve una seconda sigla.
- **Tutti a 38 h settimanali** e tutti abilitati su entrambe le postazioni:
  nessuno dei due dati era nei documenti. Il prospetto di agosto ne ha
  identificato uno solo — CASALI, all'88,5 h contro 151,92 — e resta da sapere
  se sono 22 o 24 h. Conta davvero: l'equità delle ore è misurata sullo scarto
  dal contratto individuale.

## La copertura letta da un mese vero (18 agosto 2026)

Il prospetto `Turni Stradora AGOSTO 2026.pdf` è il primo mese reale entrato nel
progetto. Legge con `scripts/leggi-prospetto.py`, che mappa ogni cella alle
coordinate della sua colonna: `pdftotext -layout` è leggibile a occhio ma perde
le celle vuote, e una cella vuota qui è un dato.

**La regola è confermata e ora è misurata**: una persona per sigla al giorno, su
14 sigle. Su 434 celle ne deviano 14 (96,8% conformi), e si compensano a coppie
— `PF` manca nei giorni 1, 7 e 20 e raddoppia nei giorni 12 e 15. Sono
aggiustamenti a mano, non la regola.

**Due sigle su sedici erano sbagliate**, ed è tutta domanda inventata:

| | dedotto dalla legenda | misurato |
|---|---|---|
| `N` (notte 20:30–7:30) | 1/giorno → 77 h/sett | **mai usata**: agosto ha solo `N1` e `N2` |
| `PRG` | 1/giorno → 42 h/sett | **15 turni in 31 giorni** → ~20 h/sett |

843,5 − 77 − 21,7 = **744,8 h/settimana**, e la parte fissa (724,5) coincide col
prospetto all'ora. Il Bruco è a parte: 73,5 h/settimana, anch'esse dedotte allo
stesso modo e mai verificate, quindi **messe a zero** in attesa del suo
prospetto. Alcuni operatori del pool ci lavorano davvero (DESANTIS), ma quelle
ore non stanno in questo documento — e DESANTIS è già al 105% del contratto
sulla sola Stradora.

**Applicato e verificato il 18 agosto 2026.** `n_richiesti = 0` su `N` e `PRG`
(Stradora) e su `MAP` e `AP` (Il Bruco): 28 righe. La domanda letta dal database
è ora **724,5 h/settimana** contro 1064 di capacità, e coincide con la misura sul
prospetto. Il conto si chiude fino all'ultima ora: 724,5 × 31/7 = 3208,5 h di
copertura fissa mensile contro le 3250,5 h che il coordinatore ha assegnato, e
le 42 h di differenza sono le sue **6 celle in più nette** (≈ 7 h l'una).

Attenzione al 68% che ne esce: confronta la domanda con la capacità *piena*. Ad
agosto c'erano 165 giorni di assenza su 868 persona-giorno, il 19% della forza:
su quella base l'impegno reale era **84%**, e il personale ha infatti lavorato al
97% del proprio contratto. Il margine esiste, ma un mese di ferie pesanti lo
consuma quasi tutto.

**Altro che il prospetto ha corretto:**

- Mancava **un lavoratore intero**, DIMAS FERNANDES: 149 h su 23 turni, di fatto
  full-time. Il cognome sta su due righe nel prospetto e potrebbe essere
  nome+cognome.
- **23 assenze** caricate in `absences` (130 gg di ferie, 23 di malattia, 7 di
  formazione).
- `SN` non è un turno: è la coda di `N1`/`N2`, ore già contate. Compare due
  volte al giorno per 31 giorni, ed è giusto che non sia una regola di
  copertura. `RD` è reperibilità diurna, non riposo domenicale.
- Il **26 agosto è formazione per tutti**: chi aveva un turno ha `F5` come
  annotazione, chi non l'aveva ce l'ha nella griglia.

### Cosa resta aperto

- **`C` non è in legenda** — 12 occorrenze: CAVALLI nei giorni 3, 28, 31 e GENNA
  nove giorni di fila (15–23) prima delle ferie. Il conto delle ore cambia a
  seconda che sia un'assenza: −3,0% sul contratto se lo è, −4,7% se non lo è.
- **Chi è malato adesso non è in questo file.** Il PDF è compilato il 31 luglio:
  ogni `MAL` che contiene inizia il giorno 1 e finisce entro il 9. GUIDETTI ha
  lavorato 3 giorni su 31, ed è il profilo più vicino a un'assenza lunga.

### Il ciclo di riferimento non si applica più

Il README descrive un ciclo 7h/7h/10h con rapporto 2:2:1, e `ciclico.ts`
costruisce squadre su quel modello. Con 18 sigle di durata diversa quella fase
non ha più un ciclo da chiudere: la generazione ricade su greedy più ricerca
locale. Funziona, ma il piano non avrà la rotazione canonica M→P→N, e la parte
del README che la descrive ora vale per il caso teorico, non per questo
servizio.

## What's TODO (Non-Blocking)

### 🔴 Account per i test autenticati — *l'unico che spegne un controllo*
- **Stato:** i test esistono e non girano. Manca l'utente di sola lettura su
  Supabase e i due secret su GitHub; i dettagli sono sopra, in «Il punto cieco».
- **Costo di non farlo:** `/home`, `/pianificazione` e `/riepilogo` non sono
  verificate da nessuno, né in CI né dopo un deploy. Sono esattamente le tre
  pagine dove si sono nascosti i guasti del 2 agosto 2026.
- **Cinque minuti**, ed è l'unica voce di questo elenco che riaccende una spia.

### 🎥 Video Asset
- **Attuale:** animazione sintetica di 15 s (139 KB) + poster, generata da
  `scripts/demo-landing/genera.sh`. Usa i colori e il ciclo turni veri del
  progetto — non è una registrazione dell'applicazione.
- **Erano file da 0 byte:** la sezione mostrava un rettangolo nero, e il
  middleware rispondeva `307` alle richieste di `.mp4` (estensione assente
  dal matcher in `proxy.ts`). Entrambe le cose sono corrette.
- **Da fare:** sostituire con una registrazione vera dello schermo.
  Scaletta di ripresa, requisiti tecnici e comandi di ricodifica in
  `docs/video-demo-scaletta.md`.

### 📧 Newsletter Backend
- **Fatto:** il form scrive davvero su Supabase.
  - `supabase/migrations/20260802000001_newsletter.sql` — tabella
    `newsletter_subscriptions` + funzione `iscrivi_newsletter()`
  - `app/api/newsletter/route.ts` — unico endpoint aperto senza sessione
  - `lib/dati/newsletter.ts` — normalizzazione indirizzi (con test)
- **Applicata e verificata in produzione** il 2 agosto 2026. Provata dall'esterno:
  normalizza l'indirizzo, non duplica su reinvio, e il campo esca risponde `200`
  senza creare righe. `anon` non può leggere né scrivere la tabella
  direttamente — solo eseguire la funzione.
- **Perché una funzione invece di una policy:** la chiave pubblicabile sta nel
  bundle del browser. Una policy di insert per `anon` renderebbe la tabella
  scrivibile da chiunque. La tabella non ha policy di scrittura: si entra solo
  dalla funzione `security definer`, che valida e normalizza.
- **Antiabuso:** c'è un campo esca per i bot, **non** un rate limit. Un
  endpoint pubblico di scrittura senza limiti di frequenza resta esposto:
  serve uno store condiviso (Upstash, o una tabella con finestra temporale).
- **Doppio opt-in:** la colonna `confermata` nasce a `false` ed è oggi sempre
  `false`. **Nessuna email va inviata** finché non esiste il giro di conferma.
- **Prossimo passo:** collegare Resend leggendo dalla tabella, non sostituendola.

### 📊 Dashboard Database Queries
- **Stats:** ✅ Fatto — `lib/dati/statistiche.ts` (`statisticheDashboard`)
  - `pianiMese` — righe `schedules` con `mese` = mese corrente
  - `oreMese` — somma di `durata_min * peso_ore` sulle assegnazioni del piano
    più recente del mese, saltando i turni con `conta_nelle_ore = false`
  - `lavoratoriAttivi` — `workers` con `attivo = true`
  - Nessun filtro per utente nel codice: ci pensa RLS, quindi il pianificatore
    vede i totali e il lavoratore le proprie ore sui soli piani pubblicati
  - Test: `lib/dati/statistiche.test.ts` (parte pura del calcolo ore)
- **Activity feed:** ✅ Fatto — `lib/dati/attivita.ts` (`attivitaRecenti`)
  - Ricostruito dai timestamp esistenti, senza tabella di audit: `aggiornato_il`
    di `planning_runs`, `creato_il` di `workers` e `positions`
  - I piani con `versione > 1` si leggono come "aggiornato" invece di "generato"
  - Filtro per ruolo di nuovo a carico di RLS: il lavoratore vede solo i piani
    pubblicati (`planning runs lettura` in `20260730000001_planning_runs.sql`)
  - Test: `lib/dati/attivita.test.ts`
  - **Limite noto:** i timestamp di riga dicono *quando* qualcosa è stato creato
    o toccato, non quante volte né da chi, e le modifiche alla copertura non
    lasciano traccia (`coverage_rules` non ha colonne temporali). Per una
    cronologia vera servirebbe una tabella di audit.

### 💬 Testimonianze
- **Rimosse.** Erano due citazioni inventate («Marco R., HR Manager, PMI Veneto»
  e «Lucia B., Coordinatrice Turni, Lomellina») con cinque stelle, pubblicate
  come se fossero pareri di clienti reali. Inventare consenso sociale è la cosa
  più facile da fare e la più difficile da recuperare quando emerge.
- **Al loro posto** `BetaNotice.tsx`: cosa è pronto e cosa manca, in due elenchi.
- **Quando ce ne saranno di vere:** vanno raccolte con il consenso scritto di chi
  le firma, con nome e organizzazione reali. Una testimonianza anonima o
  parafrasata vale meno di nessuna testimonianza.

### 📮 Casella di posta assente
- `turni.app` **non ha record MX**: nessun indirizzo su quel dominio riceve
  posta. `info@turni.app` compariva in tre punti della landing, compreso il
  canale di cancellazione dalla newsletter.
- **Ora** i contatti passano dalle issue di GitHub. Prima di uscire dalla beta
  serve una casella vera: un canale di opt-out che rimbalza non è un canale.

---

## Design & Copy Notes

### Colors
- **Primary:** `#3B82F6` (blue) — buttons, links, accents
- **Success:** `#10B981` (green) — checkmarks, confirmations
- **Text Dark:** `#1F2937` — headlines, body
- **Muted:** `#6B7280` — secondary text
- **Background:** `#FFFFFF` (white), alt `#F9FAFB` (light grey)

### Typography
- **Headlines (h1):** 48-56px desktop, 32-40px mobile, bold
- **Subheaders (h2):** 28-36px desktop, 20-28px mobile, semibold
- **Body:** 16px, regular, line-height 1.6
- **Font:** System sans-serif (Tailwind defaults: Geist, Inter, etc.)

### Copy Tone
- **Professional** — for HR managers, shift coordinators
- **Problem-focused** — starts with pain points, then solution
- **Italian** — all copy in Italian, no English
- **Action-oriented** — CTAs are clear and low-friction (free, fast, no credit card)

---

## Testing Checklist

Before considering this "done":

- [ ] Landing page loads at `/`
- [ ] All 8 sections render correctly
- [ ] Hero CTA buttons work (link to sign-up)
- [ ] Demo CTA scrolls to video section
- [ ] Video placeholder plays (or shows fallback)
- [ ] Problem+solution is readable (2-col on desktop, 1-col on mobile)
- [ ] Features grid is responsive
- [ ] La sezione beta elenca cosa è pronto e cosa manca
- [ ] FAQ accordion expands/collapses
- [ ] Newsletter form accepts email (shows success)
- [ ] Footer links work
- [ ] Sign up/login works
- [ ] Dashboard appears after login
- [ ] Dashboard shows welcome header with user name
- [ ] Stats riflettono i dati reali del mese corrente (0 ovunque su DB vuoto)
- [ ] Quick action buttons navigate to main pages
- [ ] Activity feed displays
- [ ] Responsive on mobile (375px), tablet (768px), desktop (1024px+)
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Color contrast passes (Lighthouse)
- [ ] All tests pass (`npm test`)

---

## Deployment Notes

- **Landing page is live immediately** when merged to main
- **No new environment variables needed** (uses existing Supabase auth)
- **Database changes:** None (landing page is read-only, newsletter TODO is optional)
- **Performance:** All components are lightweight, should load fast
- **SEO:** Use Vercel's built-in metadata (title, description in layout.tsx)
- **Analytics:** Currently not tracked — recommend adding if you care about landing page conversion rate

---

## Questions?

See:
- **Design spec:** `docs/superpowers/specs/2026-08-01-landing-page-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-08-01-landing-page.md`
- **Landing page guide:** `docs/landing-page.md` (dev guide for future updates)

---

**Handoff complete. Ready for testing and iteration!** 🚀
