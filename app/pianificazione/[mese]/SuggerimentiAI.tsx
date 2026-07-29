"use client"

import Link from "next/link"
import { useState } from "react"

interface Suggerimento {
  priorita: "alta" | "media" | "bassa"
  titolo: string
  spiegazione: string
  azioni: string[]
  percorso: string | null
}

interface Esito {
  diagnosi: string
  suggerimenti: Suggerimento[]
  limiti: string
}

const ETICHETTE_PERCORSO: Record<string, string> = {
  "/copertura": "Apri copertura",
  "/lavoratori": "Apri lavoratori",
  "/vincoli": "Apri vincoli",
  "/impostazioni": "Apri impostazioni",
  "/pianificazione": "Resta in pianificazione",
}

function RisultatoSuggerimenti({ esito }: { esito: Esito }) {
  return (
    <div className="mt-3 space-y-3 border-t border-accento/20 pt-3">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-tenue">
          Diagnosi
        </div>
        <p className="mt-1 text-sm">{esito.diagnosi}</p>
      </div>

      <ol className="space-y-2">
        {esito.suggerimenti.map((s, indice) => (
          <li
            key={`${s.titolo}-${indice}`}
            className="rounded-lg border border-bordo bg-superficie p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  s.priorita === "alta"
                    ? "bg-allarme-tenue text-allarme"
                    : s.priorita === "media"
                      ? "bg-avviso-tenue text-avviso"
                      : "bg-bordo/50 text-tenue"
                }`}
              >
                {s.priorita}
              </span>
              <h4 className="text-sm font-medium">{s.titolo}</h4>
            </div>
            <p className="mt-2 text-sm text-tenue">{s.spiegazione}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {s.azioni.map((azione, i) => (
                <li key={i}>· {azione}</li>
              ))}
            </ul>
            {s.percorso && (
              <Link href={s.percorso} className="bottone mt-3 inline-block py-1 text-xs">
                {ETICHETTE_PERCORSO[s.percorso] ?? "Apri"} →
              </Link>
            )}
          </li>
        ))}
      </ol>

      <p className="text-xs text-tenue">
        <strong>Da verificare:</strong> {esito.limiti}
      </p>
    </div>
  )
}

export default function SuggerimentiAI({
  dal,
  al,
  numeroSegnalazioni,
  segnalazioneId,
}: {
  dal: string
  al: string
  numeroSegnalazioni?: number
  segnalazioneId?: string
}) {
  const [esito, setEsito] = useState<Esito | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function analizza() {
    setInCorso(true)
    setErrore(null)
    try {
      const risposta = await fetch("/api/ai/suggerimenti-piano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dal, al, segnalazioneId }),
      })
      const dati = await risposta.json()
      if (!risposta.ok) throw new Error(dati.errore ?? "Analisi non riuscita.")
      setEsito(dati)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore imprevisto.")
    } finally {
      setInCorso(false)
    }
  }

  if (segnalazioneId) {
    return (
      <div className="mt-2 text-testo">
        <button
          type="button"
          className="bottone py-1 text-xs"
          disabled={inCorso}
          onClick={analizza}
        >
          {inCorso
            ? "Chiedo all’AI…"
            : esito
              ? "Rigenera suggerimento"
              : "Chiedi un suggerimento all’AI"}
        </button>
        {errore && (
          <div className="mt-2 rounded-lg bg-allarme-tenue p-3 text-sm text-allarme">
            {errore}
          </div>
        )}
        {esito && <RisultatoSuggerimenti esito={esito} />}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-accento/30 bg-accento-tenue/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">Analisi AI completa</h3>
            <span className="rounded-full bg-avviso-tenue px-2 py-0.5 text-[10px] font-semibold uppercase text-avviso">
              Premium · attiva per ora
            </span>
          </div>
          <p className="mt-0.5 text-xs text-tenue">
            Analizza tutte le {numeroSegnalazioni ?? 0} segnalazioni insieme a
            copertura, organico, assenze e vincoli. Consuma più risorse e non
            modifica nulla automaticamente.
          </p>
        </div>
        <button
          type="button"
          className="bottone bottone-primario"
          disabled={inCorso}
          onClick={analizza}
        >
          {inCorso
            ? "Analizzo…"
            : esito
              ? "Rigenera analisi completa"
              : "Analizza tutte con l’AI"}
        </button>
      </div>

      {errore && (
        <div className="mt-3 rounded-lg bg-allarme-tenue p-3 text-sm text-allarme">
          {errore}
        </div>
      )}

      {esito && <RisultatoSuggerimenti esito={esito} />}
    </div>
  )
}
