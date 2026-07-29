# Turni

Pianificazione dei turni di lavoro per **n lavoratori** su **m postazioni**, con
assistente in linguaggio naturale.

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

### Il solver — `lib/solver/`

Tre fasi, dalla più strutturata alla più opportunistica:

1. **`ciclico.ts`** — costruisce il ciclo a squadre dove la domanda giornaliera
   lo consente. È ciò che produce la rotazione canonica invece di una soluzione
   solo "valida".
2. **`greedy.ts`** — riempie ciò che il ciclo non ha coperto, partendo dagli
   slot con meno candidati (le notti).
3. **`ricerca.ts`** — ricerca locale (simulated annealing) per adattare il piano
   ad assenze, vincoli e festività.

I **vincoli rigidi sono invarianti, non penalità**: `puoAssegnare()` è il
guardiano e nessuna mossa che lo violi viene mai applicata. Un piano generato
non può quindi contenere riposi insufficienti o assenze ignorate — sono
impossibili per costruzione. L'unico esito insoddisfacente possibile è uno
**slot scoperto**, che è un problema di organico e viene riportato come tale.

Il solver è **deterministico**: stesso seme + stessi dati = stesso piano.

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

Compila `.env.local` (già presente con i valori Supabase; aggiungi la chiave AI):

```
GLM_API_KEY=la-tua-chiave
```

```bash
npm run dev
```

Apri <http://localhost:3000> e **crea il primo accesso**: il primo utente
registrato diventa automaticamente amministratore.

Il database contiene già dati dimostrativi — 3 postazioni, 21 lavoratori,
copertura 2/2/1 — che è esattamente l'organico del ciclo a 7 squadre su 3
postazioni (798 ore richieste = 798 disponibili).

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

Progetto Supabase `turni` (`uxwmletpnmsbvdyxktln`, eu-central-1, piano free).
RLS attiva: `admin` e `pianificatore` hanno accesso completo, `lavoratore` vede
in sola lettura i propri turni sui piani pubblicati.
