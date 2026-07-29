# Turni

Pianificazione dei turni di lavoro per **n lavoratori** su **m postazioni**, con
assistente in linguaggio naturale.

**Italiano** · [English](#english)

## Il ciclo di riferimento

Con turni da **7h / 7h / 10h** (mattino 07-14, pomeriggio 14-21, notte 21-07) la
settimana tipo

```
  M  M  P  P  N  R  R      ->  2x7 + 2x7 + 1x10 = 38 ore esatte
```

vale precisamente il monte ore contrattuale, ruota in avanti M→P→N e lascia
**48 ore di riposo dopo la notte** (che finisce alle 07:00, seguita da due
giorni liberi).

Ne discende il dimensionamento dell'organico. Ogni persona produce
settimanalmente **2 mattini, 2 pomeriggi e 1 notte** — rapporto 2:2:1. Perché i
conti chiudano, la copertura richiesta deve avere lo stesso rapporto:

> Una postazione presidiata 24/7 con **2 al mattino, 2 al pomeriggio e 1 di
> notte** è coperta esattamente da **7 lavoratori** sfasati di un giorno l'uno
> dall'altro. Ogni giorno i 7 occupano le 7 fasi del ciclo: 2 in mattino, 2 in
> pomeriggio, 1 in notte, 2 a riposo. Scarto zero.

Se invece una postazione richiede 1 sola persona per turno (rapporto 1:1:1) il
ciclo non chiude: servirebbero 7 persone per coprire le 7 notti, generando 14
mattini disponibili contro i 7 necessari. L'app se ne accorge e lo dice **prima**
di generare, invece di produrre un piano bucato senza spiegazione.

## Architettura

**L'AI non genera i turni.** Traduce le richieste in italiano
(«Marco Rossi ha bisogno della domenica pomeriggio libera») in vincoli
strutturati, che l'utente conferma; poi un **solver deterministico** costruisce
il piano.

```
  AI propone -> l'app valida -> l'utente conferma -> il solver decide
```

Un modello linguistico che producesse direttamente la griglia non potrebbe
garantire copertura, monte ore o riposi, e non sarebbe riproducibile.

### Modifica manuale e salvataggio del piano

Dopo **Genera il piano**, entrambe le proiezioni della griglia restano
interattive senza perdere il formato compatto e i colori dei turni:

- nella vista **per lavoratore**, un clic sulla cella giorno/lavoratore apre
  l'editor per cambiare turno e postazione oppure impostare il riposo;
- nella vista **per postazione**, un clic sulla cella giorno/postazione/turno
  permette di aggiungere o rimuovere i lavoratori. Se un lavoratore è già
  impegnato nello stesso giorno, viene spostato nella nuova cella;
- le celle modificate sono segnalate senza alterare i colori del piano;
- **Salva modifiche** scrive in Supabase solo le celle cambiate, mentre
  **Annulla** ripristina l'ultimo stato salvato.

Le assegnazioni manuali vengono memorizzate con origine `manuale` e marcate
come bloccate. Una nuova generazione del piano sostituisce comunque l'intero
mese, comportamento indicato anche nell'interfaccia.

### Il solver — `lib/solver/`

Tre fasi, dalla più strutturata alla più opportunistica:

1. **`ciclico.ts`** — costruisce il ciclo a squadre dove la domanda giornaliera
   lo consente. È ciò che produce la rotazione canonica invece di una soluzione
   solo "valida".
2. **`greedy.ts`** — riempie ciò che il ciclo non ha coperto, partendo dagli
   slot con meno candidati (le notti).
3. **`ricerca.ts`** — ricerca locale (simulated annealing) per adattare il piano
   ad assenze, vincoli e festività.

I principali **vincoli rigidi sono invarianti, non penalità**: `puoAssegnare()`
controlla le assegnazioni proposte dalle fasi ciclica, greedy e di ricerca.
Eventuali slot che non possono essere coperti vengono lasciati scoperti e
riportati esplicitamente. Le assegnazioni fisse importate dai dati sono
installate separatamente e devono quindi essere valide a monte.

Le fasi ciclica e greedy sono **riproducibili**: stesso seme + stessi dati
producono lo stesso risultato. La ricerca locale è invece limitata dal tempo e
può eseguire un numero diverso di iterazioni in base al carico della macchina.

#### Ore contrattuali contro riposo reale

Nella notte del cambio d'ora un turno 21:00→07:00 dura 9 ore reali (o 11 in
autunno). La distinzione è deliberata:

- **ore contabilizzate** → durata nominale, perché è quanto prevede il contratto;
- **riposo minimo** → tempo reale trascorso, perché le 11 ore di legge sono un
  minimo di sicurezza.

### Livello AI — `lib/ai/`

`provider.ts` è un registro: cambiare modello significa cambiare una variabile
d'ambiente, senza toccare il codice.

| Provider | Variabile | Modello di default | Verificato |
|---|---|---|---|
| GLM (Z.ai) | `GLM_API_KEY` | `glm-4.7-flash` | 6/6 |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek-chat` | 6/6 |
| Mistral | `MISTRAL_API_KEY` | `mistral-large-latest` | — |
| Kimi (Moonshot) | `MOONSHOT_API_KEY` | `kimi-k2` | — |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-5` | — |
| OpenAI | `OPENAI_API_KEY` | `gpt-5` | — |
| qualsiasi altro | `AI_API_KEY` + `AI_BASE_URL` | da `AI_MODEL` | — |

### GLM e il piano gratuito

Tre cose scoperte provando sul campo, tutte con sintomi ingannevoli.

**Solo i modelli `-flash` sono gratuiti.** `glm-4.6`, `glm-4.7` e `glm-5.2`
rispondono `429 · codice 1113 · insufficient balance` se l'account non ha
credito. Sembra una chiave non valida, ma la chiave è corretta: è il modello a
essere a pagamento.

**I Flash sono modelli di ragionamento.** Lasciati liberi scrivono la catena di
pensiero in `reasoning_content` — oltre 1800 caratteri anche per una frase
banale — e restituiscono `content` vuoto quando il budget di token finisce
prima. Il registro inietta perciò `thinking: {type: "disabled"}` nel corpo
della richiesta, tramite un middleware su `fetch`: l'adattatore
OpenAI-compatibile non prevede parametri proprietari.

**I Flash ignorano `response_format: json_schema`.** Lo accettano senza errore e
poi rispondono in prosa. Peggio: con il ripiego `json_object` l'adattatore
chiede "un JSON qualsiasi" **senza allegare lo schema**, e il modello se ne
inventa uno proprio (`{"answer": "..."}`) — JSON perfettamente valido, con i
campi sbagliati. Per questo lo schema viene ripetuto **nel prompt di sistema**,
generato da zod con `schemaComeTesto()` così non può divergere dal validatore.

Fra i due Flash gratuiti, `glm-4.7-flash` è nettamente più affidabile:
6/6 in circa 5 secondi a richiesta, mentre `glm-4.5-flash` fallisce a
intermittenza e arriva a impiegarci 60 secondi. Il piano gratuito tollera circa
una richiesta al secondo: i test d'integrazione fanno una pausa fra l'uno e
l'altro, altrimenti si autoinfliggono dei 429.

Per vedere richiesta e risposta grezze quando qualcosa non torna:

```bash
AI_DEBUG=1 npm run test:ai
```

`dsl.ts` definisce l'**insieme chiuso** di vincoli che il modello può proporre:
non può emettere logica arbitraria, e ciò che non combacia con lo schema viene
scartato prima di arrivare all'utente.

## Avvio

```bash
npm install
```

Parti da `.env.example`, crea `.env.local` e inserisci i valori Supabase e,
facoltativamente, la chiave del provider AI:

```
GLM_API_KEY=la-tua-chiave
```

```bash
npm run dev
```

Apri <http://localhost:3000> e crea un accesso. Le migrazioni attuali assegnano
ai nuovi profili il ruolo `lavoratore`; per il primo avvio occorre promuovere in
modo sicuro un profilo ad `admin` nel database prima di usare le funzioni di
pianificazione.

Le migrazioni incluse inizializzano schema, policy RLS, turni base, festività e
impostazioni. Lavoratori, postazioni e copertura vanno configurati nell'app.

## Comandi

```bash
npm run dev
```

```bash
npm test
```

Test d'integrazione con chiamate reali al provider AI (lenti, a pagamento,
tenuti fuori dalla suite normale perché un credito esaurito non deve far
fallire la build):

```bash
npm run test:ai
```

```bash
npm run build
```

```bash
npm run typecheck
```

## Struttura

```
app/
  pianificazione/[mese]/   schermata principale: griglia, generazione, segnalazioni
  vincoli/                 elenco vincoli + assistente in linguaggio naturale
  lavoratori|postazioni|turni|copertura|impostazioni/
  api/piano/genera         invoca il solver e salva il piano
  api/piano/fattibilita    verifica dell'organico, prima di generare
  api/piano/assegnazioni   valida e salva le modifiche manuali alla griglia
  api/ai/vincoli           estrazione (propone, non scrive)
  api/vincoli              salvataggio dei vincoli confermati
  api/export/xlsx|ics
lib/
  solver/    modello, vincoli, ciclico, greedy, ricerca, fattibilità
  ai/        registro provider, DSL, estrazione
  dati/      accesso a Supabase, formattazione italiana
supabase/migrations/
```

## Base dati

Il progetto usa Supabase/PostgreSQL. Le migrazioni sono in
`supabase/migrations/`. RLS è attiva: `admin` e `pianificatore` gestiscono la
pianificazione, mentre `lavoratore` vede in sola lettura i propri turni sui
piani pubblicati.

---

<a id="english"></a>

# Turni — English

Work-shift planning for **n workers** across **m positions**, with a
natural-language assistant.

[Italiano](#turni) · **English**

## Reference rotation

With **7h / 7h / 10h** shifts (morning 07:00–14:00, afternoon 14:00–21:00,
night 21:00–07:00), the standard week is:

```
  M  M  A  A  N  R  R      ->  2x7 + 2x7 + 1x10 = exactly 38 hours
```

This exactly matches the contractual weekly hours, rotates forward M→A→N, and
leaves **48 hours of rest after the night shift**, which ends at 07:00 and is
followed by two days off.

This determines the required staffing level. Each worker produces **two
morning, two afternoon, and one night shift** per week—a 2:2:1 ratio. To balance
exactly, required coverage must use the same ratio:

> One position staffed 24/7 by **two workers in the morning, two in the
> afternoon, and one at night** is covered exactly by **seven workers**, each
> offset by one day. Every day, the seven workers occupy all seven phases of
> the rotation: two mornings, two afternoons, one night, and two rest days.

If a position instead needs one worker on each shift—a 1:1:1 ratio—the rotation
does not balance: seven workers would be needed to cover seven nights, but they
would also supply fourteen morning shifts when only seven are required. The app
detects and explains this **before** generating a schedule rather than silently
producing an incomplete plan.

## Architecture

**AI does not generate the schedule.** It translates requests such as “Marco
Rossi needs Sunday afternoon off” into structured constraints for the user to
confirm. A scheduling solver then builds the plan.

```
  AI proposes -> the app validates -> the user confirms -> the solver decides
```

Having a language model produce the grid directly would not guarantee coverage,
contract hours, or legal rest periods, and its result would not be reproducible.

### Manual schedule editing and persistence

After **Generate schedule**, both grid projections remain interactive while
preserving the compact layout and the shift colors:

- in the **by worker** view, clicking a worker/day cell opens an editor to
  change the shift and position or mark the day as rest;
- in the **by position** view, clicking a position/shift/day cell lets the user
  add or remove workers. A worker already assigned on that day is moved to the
  selected cell;
- changed cells are indicated without replacing the schedule's color coding;
- **Save changes** persists only changed cells to Supabase, while **Cancel**
  restores the last saved state.

Manual assignments are stored with `manuale` origin and marked as locked.
Generating the month again still replaces the complete schedule, and the UI
states this explicitly.

### Solver — `lib/solver/`

The solver has three stages, from most structured to most opportunistic:

1. **`ciclico.ts`** builds team rotations wherever daily demand permits. This
   produces the canonical forward rotation rather than a merely valid plan.
2. **`greedy.ts`** fills slots not covered by the rotation, starting with those
   that have the fewest candidates—usually nights.
3. **`ricerca.ts`** runs local search (simulated annealing) to adapt the plan to
   absences, additional constraints, and holidays.

The main **hard constraints are invariants, not penalties.** `puoAssegnare()`
checks assignments proposed by the cyclic, greedy, and local-search stages.
Slots that cannot be covered remain empty and are reported explicitly. Fixed
assignments loaded from storage are installed separately and must therefore be
valid before solving.

The cyclic and greedy stages are **reproducible**: identical input and seed
produce the same result. Local search is wall-clock bounded, so machine load can
change the number of iterations it completes.

#### Contract hours versus elapsed rest

During a daylight-saving transition, a 21:00–07:00 shift lasts nine or eleven
real hours. The distinction is intentional:

- **accounted hours** use nominal duration, as required by the employment
  contract;
- **minimum rest** uses real elapsed time, because the legal eleven-hour minimum
  is a safety requirement.

### AI layer — `lib/ai/`

`provider.ts` is a provider registry. A model can be changed through environment
variables without modifying application code.

| Provider | Environment variable | Default model | Verified |
|---|---|---|---|
| GLM (Z.ai) | `GLM_API_KEY` | `glm-4.7-flash` | 6/6 |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek-chat` | 6/6 |
| Mistral | `MISTRAL_API_KEY` | `mistral-large-latest` | — |
| Kimi (Moonshot) | `MOONSHOT_API_KEY` | `kimi-k2` | — |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-5` | — |
| OpenAI | `OPENAI_API_KEY` | `gpt-5` | — |
| Any OpenAI-compatible provider | `AI_API_KEY` + `AI_BASE_URL` | `AI_MODEL` | — |

### GLM and its free tier

Three implementation details were discovered through real provider testing:

**Only `-flash` models are free.** Without account credit, paid GLM models can
return `429`, code `1113`, “insufficient balance.” This can look like an invalid
key even when authentication is correct.

**Flash models are reasoning models.** If unrestricted, they may spend their
token budget on `reasoning_content` and return empty `content`. The provider
registry therefore injects `thinking: {type: "disabled"}` through fetch
middleware because the OpenAI-compatible adapter does not expose proprietary
parameters.

**Flash models may ignore `response_format: json_schema`.** The schema is also
placed in the system prompt and generated from Zod by `schemaComeTesto()`, keeping
the prompt and runtime validator aligned.

Among the tested free models, `glm-4.7-flash` was the more reliable. The free
tier tolerates approximately one request per second, so integration tests pause
between calls to avoid self-inflicted rate limits.

To inspect raw requests and responses while debugging:

```bash
AI_DEBUG=1 npm run test:ai
```

`dsl.ts` defines the **closed set** of constraints that a model may propose.
Arbitrary logic and output that does not match the schema are rejected before
being shown to the user.

## Getting started

Install dependencies:

```bash
npm install
```

Copy `.env.example` to `.env.local`, configure Supabase, and optionally add an
AI-provider key:

```bash
cp .env.example .env.local
```

For example:

```env
GLM_API_KEY=your-key
```

Start the development server:

```bash
npm run dev
```

Open <http://localhost:3000> and create an account. Current migrations assign
new profiles the `lavoratore` role. For an initial installation, securely
promote one profile to `admin` in the database before using planning features.

The included migrations initialize the schema, RLS policies, base shift types,
holidays, and settings. Workers, positions, and coverage must be configured in
the application.

## Commands

```bash
npm run dev       # development server
npm test          # unit tests
npm run test:ai   # real-provider integration tests; may be slow or billable
npm run build     # production build
npm run typecheck # TypeScript checking
npm run lint      # ESLint
```

## Project structure

```
app/
  pianificazione/[mese]/   main grid, generation, and diagnostics
  vincoli/                 constraints and natural-language assistant
  lavoratori|postazioni|turni|copertura|impostazioni/
  api/piano/genera         invoke the solver and save a schedule
  api/piano/fattibilita    check staffing before generation
  api/piano/assegnazioni   validate and persist manual grid changes
  api/ai/vincoli           extract proposals without writing them
  api/vincoli              save confirmed constraints
  api/export/xlsx|ics
lib/
  solver/    model, constraints, rotation, greedy fill, local search, feasibility
  ai/        provider registry, DSL, extraction
  dati/      Supabase access and Italian formatting
supabase/migrations/
```

## Database

The project uses Supabase/PostgreSQL. Migrations live in
`supabase/migrations/`. RLS is enabled: `admin` and `pianificatore` manage
scheduling, while `lavoratore` has read-only access to their own assignments on
published schedules.
