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

### Pianificazione per intervallo

La schermata **Pianifica** usa un intervallo di date inclusivo. Il pianificatore
può aprire il mese corrente, visualizzare due mesi completi insieme oppure
impostare qualsiasi data iniziale e finale fino a 366 giorni. Griglia, conteggi,
fattibilità, solver, segnalazioni AI ed esportazioni Excel e ICS lavorano sullo
stesso intervallo, anche quando attraversa un cambio di mese o di anno.

L'URL canonico usa parametri ISO `dal` e `al`, entrambi inclusivi:

```text
/pianificazione/2026-08-01?dal=2026-08-20&al=2026-10-05
```

Senza parametri, `/pianificazione/[mese]` continua a rappresentare l'intero
mese indicato, mantenendo compatibili collegamenti e segnalibri esistenti. Se
l'utente deve autenticarsi, la destinazione e l'intervallo selezionato vengono
conservati dopo l'accesso.

I piani restano archiviati in record mensili compatibili con i dati esistenti,
ma l'interfaccia li combina in un'unica bozza. Generare un intervallo aggiorna
solo le date selezionate nei mesi coinvolti e conserva le assegnazioni esterne
all'intervallo nei mesi iniziale e finale.

Il solver carica sette giorni di contesto immutabile prima di `dal` e dopo `al`:
in questo modo riposi minimi e giorni consecutivi restano validi anche ai bordi
dell'intervallo. Le segnalazioni datate esterne all'intervallo non vengono
mostrate come parte della nuova generazione; quelle complessive sono associate
alla coppia `dal`/`al` che le ha prodotte.

Il salvataggio inserisce o aggiorna le nuove assegnazioni prima di eliminare le
righe diventate obsolete. Una lettura Supabase incompleta interrompe la
generazione invece di essere interpretata come un insieme di dati vuoto. Le
operazioni su più mesi non sono tuttavia una singola transazione PostgreSQL: per
una garanzia strettamente atomica fra tutti i mesi servirà una RPC transazionale.

### Modifica manuale e salvataggio del piano

Dopo **Genera il piano**, entrambe le proiezioni della griglia restano
interattive senza perdere il formato compatto. Il colore di ogni riquadro
identifica la **postazione**, mentre le lettere **M**, **P** e **N** identificano
rispettivamente il turno mattino, pomeriggio e notte:

La legenda è generata dai dati correnti: nomi e colori delle postazioni, codici,
nomi, orari di inizio/fine e durata dei turni. Salvare una modifica in
**Postazioni** o **Turni** invalida le pagine di pianificazione, così la legenda
viene ricostruita con i nuovi valori alla visita successiva.

Nella vista **per lavoratore**, una cella senza turno non resta più vuota: mostra
**R** per riposo, **F** per ferie, **🤒** per malattia, **D** per disciplinare,
**📚** per permesso per studiare e **A** per altro. Lo stato deriva dalle assenze
che includono quella data; se più assenze si sovrappongono, quella giornaliera
ha precedenza su quella legata a un solo turno. Un'assegnazione presente conserva
invece la rappresentazione principale con colore della postazione e codice del
turno. La legenda **Stati** documenta i simboli direttamente sotto il piano.

- nella vista **per lavoratore**, un clic sulla cella giorno/lavoratore apre
  l'editor per cambiare turno e postazione oppure impostare il riposo;
- nella vista **per postazione**, un clic sulla cella giorno/postazione/turno
  permette di aggiungere o rimuovere i lavoratori. Se un lavoratore è già
  impegnato nello stesso giorno, viene spostato nella nuova cella;
- le celle modificate sono segnalate senza alterare i colori del piano;
- le due viste condividono lo stesso piano in memoria: passando da una vista
  all'altra si vedono subito le stesse modifiche;
- un clic sul nome di un lavoratore o sull'intestazione postazione/turno apre
  collegamenti contestuali ai dati corrispondenti, alla copertura e al
  riepilogo;
- **Salva modifiche** scrive in Supabase solo le celle cambiate, mentre
  **Annulla** ripristina l'ultimo stato salvato.

#### Intestazioni di riga interattive

La prima colonna delle due proiezioni funziona anche come navigazione
contestuale, senza trasformare le intestazioni in collegamenti diretti e senza
interferire con la modifica delle celle:

- in **per lavoratore**, il nome apre un riquadro con le ore contrattuali e i
  collegamenti **Dati lavoratore** e **Riepilogo**;
- in **per postazione**, la coppia postazione/turno apre un riquadro con codice e
  orario del turno e i collegamenti **Dati postazione**, **Dati turno**,
  **Copertura** e **Riepilogo**;
- i collegamenti alle anagrafiche e alla copertura portano direttamente alla
  riga corrispondente, che viene evidenziata;
- se il piano contiene modifiche non salvate, il riquadro avvisa prima di
  cambiare pagina.

Le intestazioni sono pulsanti utilizzabili con tastiera. Il riquadro porta il
focus sui propri controlli, mantiene la navigazione `Tab` al suo interno, si
chiude con `Esc`, con il pulsante di chiusura o con un clic esterno e, quando
appropriato, restituisce il focus all'intestazione di partenza.

Le assegnazioni manuali vengono memorizzate con origine `manuale` e marcate
come bloccate. Una nuova generazione sostituisce le assegnazioni dell'intervallo
selezionato, comportamento indicato anche nell'interfaccia.

Se il solver lascia delle **segnalazioni**, ogni riga permette di chiedere un
suggerimento AI mirato. La richiesta contiene una sola segnalazione e riduce il
contesto a lavoratori, postazioni, turni, copertura e vincoli pertinenti, così da
limitare token, latenza e costo. L'analisi congiunta del piano include fino a
100 segnalazioni ed è identificata come funzionalità **Premium** ad alto consumo;
resta attiva durante
lo sviluppo. I suggerimenti non modificano automaticamente alcun dato: vanno
valutati dal pianificatore e verificati con una nuova esecuzione del solver.

#### Suggerimenti AI per singola segnalazione

- **`Chiedi un suggerimento all’AI`** invia l'identificativo della sola
  segnalazione selezionata; **`Rigenera suggerimento`** ripete quella stessa
  analisi senza coinvolgere gli altri avvisi.
- Il server accetta soltanto identificativi UUID appartenenti a un piano e
  all'intervallo richiesto. Valori nulli, malformati, estranei o fuori intervallo
  restituiscono un errore e non possono ripiegare sull'analisi completa più
  costosa.
- Per problemi di copertura, il contesto conserva la postazione e il turno
  citati, i lavoratori abilitati e i loro vincoli pertinenti. Per segnalazioni
  personali conserva il lavoratore citato e i relativi vincoli. Il prompt indica
  esplicitamente che deve analizzare una **singola segnalazione**.
- **`Analizza il piano con l’AI`** invia il contesto complessivo con un limite
  esplicito di 100 segnalazioni ed è
  contrassegnato `Premium · attiva per ora`: l'accesso resta aperto durante lo
  sviluppo, ma il consumo elevato è una scelta di prodotto distinta.
- Le risposte pubbliche contengono soltanto diagnosi, azioni, percorsi e limiti.
  Provider, modello, token e latenza vengono registrati internamente in
  `ai_interactions`; anche gli errori restituiti al browser sono neutralizzati e
  non rivelano dettagli del provider o dell'infrastruttura.

#### Diagnostica causale e snapshot / Causal diagnostics and snapshots

Le segnalazioni non sono più soltanto testo. Ogni buco di copertura conserva la
chiave stabile di data/postazione/turno e un riepilogo dei blocker esaminati:
assenza, abilitazione, riposo, tetto settimanale e vincoli applicabili. Una
copertura completa con obiettivi contrattuali superiori alla domanda viene
classificata come **capacità eccedente**, non come turni mancanti. La schermata
mostra questa evidenza prima del pulsante AI.

Violations carry stable slot references and structured blocker evidence. Full
coverage with contractual targets above actual demand is classified as
**excess capacity**, not as a solver failure. The planning screen shows this
evidence before offering AI advice.

Ogni generazione salva nel punteggio uno snapshot diagnostico versionato con
intervallo, seme, qualità della ricerca, fattibilità, violazioni e impronta
SHA-256 degli input di configurazione. L'analisi AI confronta l'impronta con i
dati correnti e contrassegna lo snapshot come obsoleto quando le regole sono
cambiate; non viene quindi presentata una vecchia diagnosi come attuale.

Each generation stores a versioned diagnostic snapshot in the schedule score,
including the inclusive range, seed, search quality, feasibility, violations,
and a SHA-256 input fingerprint. AI analysis compares that fingerprint with
current configuration data and marks stale snapshots instead of presenting
old evidence as current.

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
producono lo stesso risultato. La ricerca locale accetta anche un budget
deterministico `iterazioniMax`, utile per confronti e test ripetibili; in
assenza di tale budget resta limitata dal tempo e può eseguire un numero
diverso di iterazioni in base al carico della macchina.

The cyclic and greedy phases are reproducible. Local search also accepts the
deterministic `iterazioniMax` budget for repeatable comparisons; without it,
the wall-clock limit remains the intended production trade-off.

#### Ore contrattuali contro riposo reale

Nella notte del cambio d'ora un turno 21:00→07:00 dura 9 ore reali (o 11 in
autunno). La distinzione è deliberata:

- **ore contabilizzate** → durata nominale, perché è quanto prevede il contratto;
- **riposo minimo** → tempo reale trascorso, perché le 11 ore di legge sono un
  minimo di sicurezza.

### Livello AI — `lib/ai/`

`provider.ts` è un registro: cambiare modello significa cambiare una variabile
d'ambiente, senza toccare il codice.

> **Confine di prodotto:** selettore, nomi di provider/modelli, stato delle
> chiavi, latenza e strumenti di prova sono diagnostica interna utile durante lo
> sviluppo. Non fanno parte dell'esperienza destinata agli utenti finali. In
> produzione il team sceglie provider e modello lato server in base a costo,
> qualità, affidabilità e velocità; l'interfaccia utente espone soltanto la
> funzione assistita e il suo risultato.

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

```bash
npm run lint
```

## Struttura

```
app/
  pianificazione/[mese]/   griglia e intervallo inclusivo via query dal/al
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

### Date-range planning

The **Planning** screen uses an inclusive date range. A planner can open the
current month, view two complete months together, or choose any start and end
date up to 366 days. The grid, totals, feasibility checks, solver, AI
diagnostics, and Excel and ICS exports all use that same range, including month
and year boundaries.

The canonical URL uses inclusive ISO `dal` and `al` parameters:

```text
/pianificazione/2026-08-01?dal=2026-08-20&al=2026-10-05
```

Without those parameters, `/pianificazione/[mese]` continues to represent the
complete named month, preserving existing links and bookmarks. When
authentication is required, the destination and selected range survive the
login flow.

Schedules remain stored in backward-compatible monthly records, while the UI
combines them into one draft. Generating a range replaces only its selected
dates in each affected month and preserves assignments outside the range in the
first and last months.

The solver loads seven immutable context days before `dal` and after `al`, so
minimum-rest and consecutive-day constraints remain valid at both boundaries.
Dated diagnostics outside the range are not presented as part of the new run;
range-wide diagnostics are scoped to the `dal`/`al` pair that produced them.

Persistence upserts replacement assignments before removing obsolete rows. An
incomplete Supabase read aborts generation instead of being interpreted as an
empty dataset. Multi-month writes are not yet one PostgreSQL transaction,
however; strict all-or-nothing atomicity across every month would require a
transactional RPC.

### Manual schedule editing and persistence

After **Generate schedule**, both grid projections remain interactive while
preserving the compact layout. Each square's color identifies the **position**,
while the letters **M**, **P**, and **N** identify the morning, afternoon, and
night shifts respectively:

The legend is generated from current data: position names and colors, plus
shift codes, names, start/end times, and duration. Saving a change under
**Positions** or **Shifts** invalidates the planning pages, so the legend is
rebuilt with the updated values on the next visit.

In the **by worker** view, a cell without an assigned shift is no longer blank:
it shows **R** for rest, **F** for holiday leave, **🤒** for sickness, **D** for
disciplinary leave, **📚** for study leave, and **A** for other. The state is
derived from absences that include that date; when records overlap, a whole-day
absence takes precedence over one tied to a specific shift. An existing
assignment keeps the primary position-color and shift-code representation. The
**States** legend documents these symbols directly below the schedule.

- in the **by worker** view, clicking a worker/day cell opens an editor to
  change the shift and position or mark the day as rest;
- in the **by position** view, clicking a position/shift/day cell lets the user
  add or remove workers. A worker already assigned on that day is moved to the
  selected cell;
- changed cells are indicated without replacing the schedule's color coding;
- both views share the same in-memory schedule, so switching views immediately
  shows the same changes;
- clicking a worker name or a position/shift row header opens contextual links
  to the corresponding records, coverage, and overview;
- **Save changes** persists only changed cells to Supabase, while **Cancel**
  restores the last saved state.

#### Interactive row headers

The first column in both projections also provides contextual navigation. Row
headers open a bubble rather than navigating immediately, and this interaction
does not affect assignment-cell editing:

- in **by worker**, a worker name shows contract hours and links to **Worker
  data** and **Overview**;
- in **by position**, a position/shift pair shows the shift code and hours and
  links to **Position data**, **Shift data**, **Coverage**, and **Overview**;
- record and coverage links scroll directly to and highlight the corresponding
  row;
- when the draft contains unsaved changes, the bubble warns before leaving the
  planning page.

Row headers are keyboard-operable buttons. The bubble moves focus to its own
controls, keeps `Tab` navigation inside, closes with `Escape`, its close button,
or an outside click, and restores focus to the originating header when
appropriate.

Manual assignments are stored with `manuale` origin and marked as locked.
Generating again replaces assignments in the selected range, and the UI states
this explicitly.

When the solver leaves **diagnostics**, each row offers a targeted AI
suggestion. The request contains one diagnostic and trims context to relevant
workers, positions, shifts, coverage, and constraints, reducing tokens, latency,
and cost. Joint plan analysis includes up to 100 diagnostics and is marked as a
high-consumption **Premium** feature and remains enabled during development. Suggestions never
modify data automatically: a planner must evaluate them and verify the result
by running the solver again.

#### AI suggestions for individual diagnostics

- **`Chiedi un suggerimento all’AI`** sends only the selected diagnostic ID;
  **`Rigenera suggerimento`** repeats that same analysis without including other
  warnings.
- The server accepts only UUIDs that belong to a schedule in the requested
  interval. Null, malformed, foreign, or out-of-range IDs return an error and
  cannot fall back to the more expensive whole-plan analysis.
- For coverage problems, context retains the referenced position and shift,
  qualified workers, and their relevant constraints. Worker diagnostics retain
  the referenced worker and related constraints. The prompt explicitly limits
  the model to a **single diagnostic**.
- **`Analizza il piano con l’AI`** sends whole-plan context with an explicit
  100-diagnostic limit and is
  labelled `Premium · attiva per ora`: it remains available during development,
  while its higher consumption is treated as a separate product capability.
- Public responses contain only the diagnosis, actions, application paths, and
  limitations. Provider, model, token, and latency metadata is retained
  internally in `ai_interactions`; browser-facing errors are also sanitized so
  they do not disclose provider or infrastructure details.

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

> **Product boundary:** provider/model selectors and names, API-key status,
> latency, and connection-test tooling are internal diagnostics that are useful
> while building the application. They are not part of the end-user experience.
> In production, the team selects the server-side provider and model according
> to cost, quality, reliability, and speed; the user interface exposes only the
> assisted task and its result.

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
  pianificazione/[mese]/   grid and inclusive range via dal/al query parameters
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
