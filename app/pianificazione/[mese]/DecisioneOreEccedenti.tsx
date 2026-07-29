"use client"

import { useState } from "react"

type Politica = "concentrata" | "distribuita"

export default function DecisioneOreEccedenti({
  oreEccedenti,
  numeroLavoratori,
}: {
  oreEccedenti: number
  numeroLavoratori: number
}) {
  const [politica, setPolitica] = useState<Politica>("distribuita")
  const [confermata, setConfermata] = useState(false)
  const lavoratoriConcentrata = Math.min(10, Math.max(1, numeroLavoratori))
  const quotaConcentrata = oreEccedenti / lavoratoriConcentrata
  const quotaDistribuita =
    numeroLavoratori > 0 ? oreEccedenti / numeroLavoratori : oreEccedenti

  function seleziona(nuovaPolitica: Politica) {
    setPolitica(nuovaPolitica)
    setConfermata(false)
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
            politica === "concentrata"
              ? "border-accento bg-white/10"
              : "border-bordo"
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
            politica === "distribuita"
              ? "border-accento bg-white/10"
              : "border-bordo"
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
          onClick={() => setConfermata(true)}
        >
          Conferma criterio
        </button>
        {confermata && (
          <span className="text-accento">
            Criterio selezionato: {politica === "distribuita" ? "distribuito" : "concentrato"}.
            Nessuna assegnazione è stata modificata.
          </span>
        )}
      </div>

      <p className="text-xs text-tenue">
        La selezione è consultiva: prima di cambiare il piano verranno mostrati i
        lavoratori e le date coinvolte, insieme a copertura e ore residue.
      </p>
    </section>
  )
}
