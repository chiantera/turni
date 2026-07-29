"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

interface Proposta {
  kind: string
  descrizione: string
  is_hard: boolean
  params: Record<string, unknown>
  valido_dal: string | null
  valido_al: string | null
  riferimenti: { campo: string; scritto: string; risolto: string | null }[]
  problemi: string[]
  confidenza: number
}

interface Esito {
  proposte: Proposta[]
  riepilogo: string
  serveChiarimento: boolean
  domanda: string | null
  provider: string
  modello: string
  latenzaMs: number
}

const ESEMPI = [
  "Marco Rossi ha bisogno della domenica pomeriggio libera",
  "Giulia Bianchi non fa mai il turno di notte",
  "Luca Ferrari al massimo 3 notti al mese",
  "Chiara Colombo è in ferie dal 10 al 20 agosto",
  "Rossi e Bianchi non devono stare nello stesso turno",
]

export default function Assistente({ mese }: { mese: string }) {
  const router = useRouter()
  const [testo, setTesto] = useState("")
  const [esito, setEsito] = useState<Esito | null>(null)
  const [scelte, setScelte] = useState<Set<number>>(new Set())
  const [inCorso, setInCorso] = useState(false)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function interpreta() {
    if (!testo.trim()) return
    setInCorso(true)
    setErrore(null)
    setEsito(null)
    try {
      const r = await fetch("/api/ai/vincoli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testo, mese }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.errore ?? "Interpretazione non riuscita.")
      setEsito(d)
      // Preseleziono solo le proposte senza problemi.
      setScelte(
        new Set(
          d.proposte
            .map((p: Proposta, i: number) => (p.problemi.length === 0 ? i : -1))
            .filter((i: number) => i >= 0),
        ),
      )
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore imprevisto.")
    } finally {
      setInCorso(false)
    }
  }

  async function conferma() {
    if (!esito || scelte.size === 0) return
    setSalvataggio(true)
    setErrore(null)
    try {
      const r = await fetch("/api/vincoli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origine: "ai",
          testo,
          vincoli: [...scelte].map((i) => ({ ...esito.proposte[i], peso: 50 })),
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.errore ?? "Salvataggio non riuscito.")
      setEsito(null)
      setTesto("")
      router.refresh()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore imprevisto.")
    } finally {
      setSalvataggio(false)
    }
  }

  return (
    <section className="scheda p-4 space-y-3">
      <div>
        <h2 className="font-medium">Scrivi un vincolo in italiano</h2>
        <p className="text-sm text-tenue mt-1">
          L&apos;assistente propone; nulla viene applicato finché non confermi.
        </p>
      </div>

      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Es.: Marco Rossi ha bisogno della domenica pomeriggio libera"
        className="campo resize-y"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) interpreta()
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={interpreta}
          disabled={inCorso || !testo.trim()}
          className="bottone bottone-primario"
          type="button"
        >
          {inCorso ? "Interpreto…" : "Interpreta"}
        </button>
        <span className="text-xs text-tenue">Ctrl+Invio</span>
      </div>

      {!esito && (
        <div className="flex flex-wrap gap-2">
          {ESEMPI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setTesto(e)}
              className="text-xs px-2 py-1 rounded-full border border-bordo text-tenue hover:border-accento"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {errore && (
        <div className="rounded-lg bg-allarme-tenue text-allarme text-sm p-3">{errore}</div>
      )}

      {esito && (
        <div className="space-y-3 pt-2 border-t border-bordo">
          <p className="text-sm">{esito.riepilogo}</p>

          {esito.domanda && (
            <div className="rounded-lg bg-avviso-tenue text-avviso text-sm p-3">
              <strong>Serve un chiarimento:</strong> {esito.domanda}
            </div>
          )}

          {esito.proposte.length === 0 ? (
            <p className="text-sm text-tenue">Nessun vincolo ricavato dal testo.</p>
          ) : (
            <ul className="space-y-2">
              {esito.proposte.map((p, i) => {
                const bloccata = p.problemi.length > 0
                return (
                  <li
                    key={i}
                    className={`rounded-lg border p-3 ${
                      bloccata ? "border-allarme bg-allarme-tenue" : "border-bordo"
                    }`}
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        disabled={bloccata}
                        checked={scelte.has(i)}
                        onChange={(e) => {
                          const s = new Set(scelte)
                          if (e.target.checked) s.add(i)
                          else s.delete(i)
                          setScelte(s)
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{p.descrizione}</div>

                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-tenue">
                          <span className="px-1.5 py-0.5 rounded bg-bordo/50">{p.kind}</span>
                          <span>{p.is_hard ? "obbligo assoluto" : "preferenza"}</span>
                          {p.riferimenti
                            .filter((r) => r.risolto)
                            .map((r, j) => (
                              <span key={j}>
                                {r.campo}: <strong className="text-testo">{r.risolto}</strong>
                                {r.risolto !== r.scritto && ` (da "${r.scritto}")`}
                              </span>
                            ))}
                        </div>

                        {bloccata && (
                          <ul className="mt-2 text-xs text-allarme space-y-0.5">
                            {p.problemi.map((x, j) => (
                              <li key={j}>· {x}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={conferma}
              disabled={salvataggio || scelte.size === 0}
              className="bottone bottone-primario"
              type="button"
            >
              {salvataggio
                ? "Salvo…"
                : `Conferma ${scelte.size} ${scelte.size === 1 ? "vincolo" : "vincoli"}`}
            </button>
            <button onClick={() => setEsito(null)} className="bottone" type="button">
              Annulla
            </button>
            <span className="text-xs text-tenue ml-auto">
              {esito.provider} · {esito.modello} · {esito.latenzaMs} ms
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
