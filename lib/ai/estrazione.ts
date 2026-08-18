/**
 * Estrazione di vincoli strutturati dal linguaggio naturale.
 *
 * Il flusso completo è: l'AI PROPONE -> l'app VALIDA -> l'utente CONFERMA ->
 * il solver DECIDE. Questo modulo copre solo il primo passo, e non scrive
 * nulla: restituisce proposte.
 *
 * La conferma umana non è una cortesia. Un vincolo interpretato al contrario
 * ("libero la domenica" invece di "lavora solo la domenica") non produce un
 * errore visibile: produce un mese di turni sbagliati che sembrano giusti.
 */

import { generateObject } from "ai"

import { eDefinitivo, traduciErrore } from "./errori"
import {
  ESEMPIO_RISPOSTA,
  SchemaEstrazione,
  problemiDiCoerenza,
  risolviNome,
  schemaComeTesto,
  type Candidato,
  type Estrazione,
  type VincoloEstratto,
} from "./dsl"
import { ottieniModello, type OpzioniModello } from "./provider"
import { nomeCompleto } from "../solver/tipi"

export interface ContestoEstrazione {
  lavoratori: { id: string; nome: string; cognome: string }[]
  postazioni: { id: string; nome: string }[]
  turni: { id: string; codice: string; nome: string }[]
  /** Mese in lavorazione, per interpretare "il 15" o "la prossima settimana". */
  mese: string
  oggi: string
}

export interface VincoloProposto {
  /** Vincolo con i riferimenti risolti in ID reali. */
  kind: VincoloEstratto["kind"]
  descrizione: string
  is_hard: boolean
  params: Record<string, unknown>
  valido_dal: string | null
  valido_al: string | null
  /** Testo dei riferimenti risolti, per mostrarlo nella card di conferma. */
  riferimenti: { campo: string; scritto: string; risolto: string | null }[]
  /** Problemi che impediscono di applicarlo così com'è. */
  problemi: string[]
  confidenza: number
}

export interface EsitoEstrazione {
  proposte: VincoloProposto[]
  riepilogo: string
  serveChiarimento: boolean
  domanda: string | null
  provider: string
  modello: string
  latenzaMs: number
  tokenInput?: number
  tokenOutput?: number
}

function costruisciPrompt(ctx: ContestoEstrazione): string {
  const lav = ctx.lavoratori
    .map((l) => `  - ${nomeCompleto(l)}`)
    .join("\n")
  const post = ctx.postazioni.map((p) => `  - ${p.nome}`).join("\n")
  const turni = ctx.turni.map((t) => `  - ${t.codice} = ${t.nome}`).join("\n")

  return `Sei un assistente che traduce richieste in italiano sui turni di lavoro in vincoli strutturati.

CONTESTO
Mese in pianificazione: ${ctx.mese}
Data odierna: ${ctx.oggi}

Lavoratori (usa ESATTAMENTE questi nomi):
${lav || "  (nessuno)"}

Postazioni (usa ESATTAMENTE questi nomi):
${post || "  (nessuna)"}

Turni disponibili (usa i CODICI):
${turni || "  (nessuno)"}

TIPI DI VINCOLO
- indisponibile     : la persona NON deve lavorare in certi giorni/turni ("domenica pomeriggio libera", "il 15 non c'è")
- preferenza        : la persona PREFERISCE certi giorni/turni, da rispettare se possibile
- turno_vietato     : la persona non fa mai un certo tipo di turno ("non fa notti")
- postazione_fissa  : la persona lavora solo su certe postazioni
- insieme           : due persone devono stare nello stesso turno
- separati          : due persone non devono coincidere
- max_turni         : tetto massimo di turni di un tipo nel mese ("massimo 4 notti")
- min_turni         : numero minimo di turni di un tipo nel mese
- ore_override      : monte ore settimanale diverso ("part-time a 20 ore")
- copertura_override: cambia quante persone servono su una postazione/turno
- assegnazione_fissa: fissa una persona su un turno preciso in una data precisa

REGOLE
1. I giorni della settimana si numerano 0=domenica, 1=lunedì, 2=martedì, 3=mercoledì, 4=giovedì, 5=venerdì, 6=sabato.
2. "libero/a", "non può", "ha bisogno di ... libero" -> indisponibile.
3. "preferirebbe", "se possibile", "meglio se" -> preferenza (is_hard = false).
4. "non può assolutamente", "mai", motivi medici o legali -> is_hard = true.
5. Se il turno non è specificato lascia "turni" a null: significa tutti i turni.
6. Se una frase contiene più richieste, restituisci più vincoli.
7. Se la richiesta è ambigua, metti serve_chiarimento = true e scrivi la
   domanda. NON tirare a indovinare: un vincolo sbagliato rovina un mese
   intero di turni.
8. Se il testo cita una persona che NON compare nell'elenco dei lavoratori,
   NON restituire un elenco vuoto — sembrerebbe che la richiesta non contenga
   nulla. Metti serve_chiarimento = true, spiega nel riepilogo che quel nome
   non è fra i lavoratori, e chiedi nella domanda a chi ci si riferisce.
   Non sostituirlo mai con il nome più somigliante.
9. Il campo "descrizione" viene mostrato all'utente per la conferma: scrivilo
   in italiano chiaro e verificabile, ripetendo il nome della persona.
10. Se il testo non contiene DAVVERO alcuna richiesta sui turni (un saluto,
    una domanda generica), restituisci un elenco vuoto e spiegalo nel
    riepilogo. Questo caso è diverso da quello della regola 8.

FORMATO DELLA RISPOSTA
Rispondi ESCLUSIVAMENTE con un oggetto JSON conforme a questo schema. Nessun
testo prima o dopo, nessun blocco markdown, nessuna spiegazione fuori dal JSON.
Tutti i campi vanno sempre valorizzati: usa null quando non si applicano.

${schemaComeTesto()}

ESEMPIO di risposta valida:
${JSON.stringify(ESEMPIO_RISPOSTA)}`
}

export async function estraiVincoli(
  testo: string,
  ctx: ContestoEstrazione,
  opz: OpzioniModello = {},
): Promise<EsitoEstrazione> {
  const { modello, provider, nomeModello } = ottieniModello(opz)
  const t0 = Date.now()

  const chiamata = (tentativi: number) =>
    generateObject({
      model: modello,
      schema: SchemaEstrazione,
      system: costruisciPrompt(ctx),
      prompt: testo,
      temperature: 0,
      maxRetries: tentativi,
    })

  // Primo tentativo senza ritentativi: credito esaurito e chiave non valida
  // arrivano come 429/401, che l'SDK ritenta comunque. Riprovare tre volte una
  // condizione permanente costa una decina di secondi e non cambia l'esito.
  let risultato
  try {
    risultato = await chiamata(0)
  } catch (primo) {
    if (eDefinitivo(primo)) throw traduciErrore(primo, provider, nomeModello)
    try {
      risultato = await chiamata(2)
    } catch (e) {
      throw traduciErrore(e, provider, nomeModello)
    }
  }

  const dati: Estrazione = risultato.object
  const proposte = dati.vincoli.map((v) => risolviVincolo(v, ctx))

  return {
    proposte,
    riepilogo: dati.riepilogo,
    serveChiarimento: dati.serve_chiarimento || proposte.some((p) => p.problemi.length > 0),
    domanda: dati.domanda,
    provider,
    modello: nomeModello,
    latenzaMs: Date.now() - t0,
    tokenInput: risultato.usage?.inputTokens,
    tokenOutput: risultato.usage?.outputTokens,
  }
}

/** Trasforma i riferimenti testuali in ID reali e raccoglie i problemi. */
function risolviVincolo(v: VincoloEstratto, ctx: ContestoEstrazione): VincoloProposto {
  const problemi = problemiDiCoerenza(v)
  const riferimenti: VincoloProposto["riferimenti"] = []
  const params: Record<string, unknown> = {}
  let confidenzaMin = 1

  const candLav: Candidato[] = ctx.lavoratori.map((l) => ({
    id: l.id,
    etichetta: nomeCompleto(l),
  }))
  const candPost: Candidato[] = ctx.postazioni.map((p) => ({
    id: p.id,
    etichetta: p.nome,
  }))

  if (v.lavoratore) {
    const r = risolviNome(v.lavoratore, candLav)
    riferimenti.push({ campo: "lavoratore", scritto: v.lavoratore, risolto: r.etichetta })
    confidenzaMin = Math.min(confidenzaMin, r.confidenza)
    if (r.id) params.lavoratore = r.id
    else
      problemi.push(
        `non riesco a identificare "${v.lavoratore}"` +
          (r.alternative.length
            ? ` — forse: ${r.alternative.slice(0, 3).map((a) => a.etichetta).join(", ")}?`
            : ""),
      )
  }

  if (v.lavoratori?.length) {
    const ids: string[] = []
    for (const nome of v.lavoratori) {
      const r = risolviNome(nome, candLav)
      riferimenti.push({ campo: "lavoratori", scritto: nome, risolto: r.etichetta })
      confidenzaMin = Math.min(confidenzaMin, r.confidenza)
      if (r.id) ids.push(r.id)
      else problemi.push(`non riesco a identificare "${nome}"`)
    }
    if (ids.length === 2) params.lavoratori = ids
  }

  if (v.postazioni?.length) {
    const ids: string[] = []
    for (const nome of v.postazioni) {
      const r = risolviNome(nome, candPost)
      riferimenti.push({ campo: "postazione", scritto: nome, risolto: r.etichetta })
      confidenzaMin = Math.min(confidenzaMin, r.confidenza)
      if (r.id) ids.push(r.id)
      else problemi.push(`postazione sconosciuta: "${nome}"`)
    }
    if (ids.length) params.postazioni = ids
  }

  if (v.turni?.length) {
    const codici: string[] = []
    for (const c of v.turni) {
      const t =
        ctx.turni.find((x) => x.codice.toLowerCase() === c.toLowerCase()) ??
        ctx.turni.find((x) => x.nome.toLowerCase() === c.toLowerCase())
      riferimenti.push({ campo: "turno", scritto: c, risolto: t?.nome ?? null })
      if (t) codici.push(t.codice)
      else problemi.push(`turno sconosciuto: "${c}"`)
    }
    if (codici.length) params.turni = codici
  }

  if (v.giorni?.length) params.giorni = v.giorni
  if (v.date?.length) params.date = v.date
  if (v.n !== null) params.n = v.n
  if (v.ore_settimana !== null) params.ore_settimana = v.ore_settimana

  return {
    kind: v.kind,
    descrizione: v.descrizione,
    is_hard: v.is_hard,
    params,
    valido_dal: v.valido_dal,
    valido_al: v.valido_al,
    riferimenti,
    problemi,
    confidenza: confidenzaMin,
  }
}
