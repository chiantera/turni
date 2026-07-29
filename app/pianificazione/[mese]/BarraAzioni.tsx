"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

interface Fattibilita {
  ok: boolean
  oreRichieste: number
  oreDisponibili: number
  scartoOre: number
  personeMancanti: number
  nottiPerPersona: number
  avvisi: string[]
  perTurno: { turno: string; slotRichiesti: number; oreRichieste: number }[]
}

export default function BarraAzioni({
  dal,
  al,
  esistente,
}: {
  dal: string
  al: string
  esistente: boolean
}) {
  const router = useRouter()
  const [inCorso, setInCorso] = useState<"verifica" | "genera" | null>(null)
  const [fattibilita, setFattibilita] = useState<Fattibilita | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState<string | null>(null)
  const [seme, setSeme] = useState(1)

  async function verifica() {
    setInCorso("verifica")
    setErrore(null)
    setEsito(null)
    try {
      const r = await fetch(`/api/piano/fattibilita?dal=${dal}&al=${al}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.errore ?? "Verifica non riuscita.")
      setFattibilita(d)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore imprevisto.")
    } finally {
      setInCorso(null)
    }
  }

  async function genera() {
    setInCorso("genera")
    setErrore(null)
    setEsito(null)
    try {
      const r = await fetch("/api/piano/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dal, al, seme, tempoMaxMs: 15_000 }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.errore ?? "Generazione non riuscita.")

      setEsito(
        d.slotScoperti === 0
          ? `Piano generato: ${d.slotTotali} turni assegnati, copertura completa (${(d.tempoMs / 1000).toFixed(1)}s).`
          : `Piano generato con ${d.slotScoperti} turni scoperti su ${d.slotTotali}. Vedi il pannello delle segnalazioni.`,
      )
      router.refresh()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore imprevisto.")
    } finally {
      setInCorso(null)
    }
  }

  return (
    <div className="no-stampa space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={verifica}
          disabled={inCorso !== null}
          className="bottone"
          type="button"
        >
          {inCorso === "verifica" ? "Verifico…" : "Verifica organico"}
        </button>

        <button
          onClick={genera}
          disabled={inCorso !== null}
          className="bottone bottone-primario"
          type="button"
        >
          {inCorso === "genera"
            ? "Genero…"
            : esistente
              ? "Rigenera il piano"
              : "Genera il piano"}
        </button>

        {esistente && (
          <label className="flex items-center gap-2 text-sm text-tenue">
            variante
            <input
              type="number"
              min={1}
              value={seme}
              onChange={(e) => setSeme(Number(e.target.value) || 1)}
              className="campo w-20 py-1"
              title="Cambia questo numero per ottenere una distribuzione alternativa a parità di vincoli"
            />
          </label>
        )}

        <a
          href={`/api/export/xlsx?dal=${dal}&al=${al}`}
          className={`bottone ml-auto ${esistente ? "" : "pointer-events-none opacity-50"}`}
        >
          Esporta in Excel
        </a>
        <button onClick={() => window.print()} className="bottone" type="button">
          Stampa
        </button>
      </div>

      {esistente && (
        <p className="text-xs text-tenue">
          Rigenerare sostituisce l&apos;intero intervallo selezionato. Lo stesso numero di variante
          produce sempre lo stesso piano: cambialo per confrontare distribuzioni
          diverse a parità di vincoli.
        </p>
      )}

      {errore && (
        <div className="scheda p-4 bg-allarme-tenue text-allarme text-sm">{errore}</div>
      )}

      {esito && <div className="scheda p-4 text-sm">{esito}</div>}

      {fattibilita && (
        <div className="scheda p-4 space-y-3">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-tenue">Ore richieste: </span>
              <strong className="tabular-nums">
                {fattibilita.oreRichieste.toFixed(0)} h
              </strong>
            </div>
            <div>
              <span className="text-tenue">Ore disponibili: </span>
              <strong className="tabular-nums">
                {fattibilita.oreDisponibili.toFixed(0)} h
              </strong>
            </div>
            <div>
              <span className="text-tenue">Scarto: </span>
              <strong
                className={`tabular-nums ${
                  fattibilita.scartoOre < 0 ? "text-allarme" : "text-accento"
                }`}
              >
                {fattibilita.scartoOre > 0 ? "+" : ""}
                {fattibilita.scartoOre.toFixed(0)} h
              </strong>
            </div>
            <div>
              <span className="text-tenue">Notti a persona: </span>
              <strong className="tabular-nums">
                {fattibilita.nottiPerPersona.toFixed(1)}
              </strong>
            </div>
          </div>

          {fattibilita.avvisi.length === 0 ? (
            <p className="text-sm text-accento">
              Organico adeguato: il piano può essere coperto interamente.
            </p>
          ) : (
            <ul className="space-y-2">
              {fattibilita.avvisi.map((a, i) => (
                <li
                  key={i}
                  className="text-sm rounded-lg bg-avviso-tenue text-avviso p-3 leading-relaxed"
                >
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
