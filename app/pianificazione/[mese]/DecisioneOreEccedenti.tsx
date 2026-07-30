"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type Politica = "concentrata" | "distribuita"

type Modifica = {
  workerId: string
  data: string
  shiftTypeId: string | null
  positionId: string | null
}

type Preview = {
  planningRunId: string
  versione: number
  modifiche: Modifica[]
  precondizioni: Modifica[]
  oreTotali: number
  lavoratori: { workerId: string; nome: string; ore: number; modifiche: number }[]
  date: string[]
  coperturaPreservata: boolean
}

export default function DecisioneOreEccedenti({
  dal,
  al,
  oreEccedenti,
  numeroLavoratori,
}: {
  dal: string
  al: string
  oreEccedenti: number
  numeroLavoratori: number
}) {
  const router = useRouter()
  const [politica, setPolitica] = useState<Politica>("distribuita")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [inCorso, setInCorso] = useState<"preview" | "applica" | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState<string | null>(null)
  const lavoratoriConcentrata = Math.min(10, Math.max(1, numeroLavoratori))
  const quotaConcentrata = oreEccedenti / lavoratoriConcentrata
  const quotaDistribuita =
    numeroLavoratori > 0 ? oreEccedenti / numeroLavoratori : oreEccedenti

  function seleziona(nuovaPolitica: Politica) {
    setPolitica(nuovaPolitica)
    setPreview(null)
    setEsito(null)
    setErrore(null)
  }

  async function visualizzaImpatto() {
    setInCorso("preview")
    setErrore(null)
    setEsito(null)
    try {
      const risposta = await fetch("/api/piano/ore-eccedenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dal, al, politica }),
      })
      const dati = await risposta.json()
      if (!risposta.ok) throw new Error(dati.errore ?? "Preview non riuscita.")
      setPreview(dati as Preview)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore imprevisto.")
    } finally {
      setInCorso(null)
    }
  }

  async function applica() {
    if (!preview || preview.modifiche.length === 0) return
    if (
      !window.confirm(
        "Applicare questa riduzione al piano? Le assegnazioni indicate verranno rimosse e il piano dovrà essere rigenerato o salvato nuovamente per ricalcolare le segnalazioni.",
      )
    ) {
      return
    }
    setInCorso("applica")
    setErrore(null)
    setEsito(null)
    try {
      const risposta = await fetch("/api/piano/ore-eccedenti/applica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planningRunId: preview.planningRunId,
          versione: preview.versione,
          precondizioni: preview.precondizioni,
        }),
      })
      const dati = await risposta.json()
      if (!risposta.ok) throw new Error(dati.errore ?? "Applicazione non riuscita.")
      setEsito(`${dati.salvate} assegnazioni rimosse dal piano.`)
      setPreview(null)
      router.refresh()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore imprevisto.")
    } finally {
      setInCorso(null)
    }
  }

  return (
    <section className="scheda space-y-3 border border-avviso/30 bg-avviso-tenue/40 p-4">
      <div>
        <h2 className="font-medium">Decidi come distribuire le ore eccedenti</h2>
        <p className="mt-1 text-sm text-tenue">
          La copertura è completa, ma restano circa {oreEccedenti.toFixed(0)} ore
          contrattuali oltre ai turni richiesti. Il piano non viene modificato
          automaticamente.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <button
          type="button"
          aria-pressed={politica === "concentrata"}
          onClick={() => seleziona("concentrata")}
          className={`rounded-lg border p-3 text-left text-sm ${
            politica === "concentrata" ? "border-accento bg-white/10" : "border-bordo"
          }`}
        >
          <strong className="block">Riduzione concentrata</strong>
          <span className="mt-1 block text-tenue">
            Circa {quotaConcentrata.toFixed(1)} h in meno per {lavoratoriConcentrata}{" "}
            lavoratori. Preserva le ore degli altri, ma concentra l&apos;impatto.
          </span>
        </button>

        <button
          type="button"
          aria-pressed={politica === "distribuita"}
          onClick={() => seleziona("distribuita")}
          className={`rounded-lg border p-3 text-left text-sm ${
            politica === "distribuita" ? "border-accento bg-white/10" : "border-bordo"
          }`}
        >
          <strong className="block">Riduzione distribuita</strong>
          <span className="mt-1 block text-tenue">
            Circa {quotaDistribuita.toFixed(1)} h in meno per ciascuno dei {numeroLavoratori}{" "}
            lavoratori. Condivide l&apos;impatto e riduce l&apos;arbitrarietà.
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          className="bottone bottone-primario"
          disabled={inCorso !== null}
          onClick={visualizzaImpatto}
        >
          {inCorso === "preview" ? "Calcolo impatto…" : "Visualizza impatto"}
        </button>
        {esito && <span className="text-accento">{esito}</span>}
      </div>

      {preview && (
        <div className="space-y-3 rounded-lg border border-bordo bg-superficie p-3 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>
              Assegnazioni da rimuovere: <strong>{preview.modifiche.length}</strong>
            </span>
            <span>
              Ore ridotte: <strong>{preview.oreTotali.toFixed(1)} h</strong>
            </span>
            <span>
              Date coinvolte: <strong>{preview.date.length}</strong>
            </span>
            {preview.coperturaPreservata && <span className="text-accento">Copertura preservata</span>}
          </div>
          {preview.date.length > 0 && (
            <details>
              <summary className="cursor-pointer font-medium">Mostra date coinvolte</summary>
              <p className="mt-1 text-tenue">{preview.date.join(", ")}</p>
            </details>
          )}
          {preview.lavoratori.length === 0 ? (
            <p className="text-avviso">Non sono state trovate assegnazioni riducibili senza scoprire la copertura.</p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {preview.lavoratori.map((lavoratore) => (
                <li key={lavoratore.workerId}>
                  {lavoratore.nome}: {lavoratore.ore.toFixed(1)} h ({lavoratore.modifiche} turni)
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="bottone bottone-primario"
            disabled={inCorso !== null || preview.modifiche.length === 0}
            onClick={applica}
          >
            {inCorso === "applica" ? "Applico…" : "Applica al piano"}
          </button>
        </div>
      )}

      {errore && <p className="text-sm text-allarme">{errore}</p>}
      <p className="text-xs text-tenue">
        Il preview considera solo assegnazioni non bloccate e ridondanti rispetto alla
        copertura richiesta. Prima dell&apos;applicazione viene richiesta una conferma esplicita.
      </p>
    </section>
  )
}
