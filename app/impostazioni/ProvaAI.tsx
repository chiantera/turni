"use client"

import { useEffect, useState } from "react"

interface Provider {
  nome: string
  etichetta: string
  modelloDefault: string
  modelliNoti: string[]
  nota: string | null
  configurato: boolean
}

export default function ProvaAI() {
  const [provider, setProvider] = useState<Provider[]>([])
  const [attivo, setAttivo] = useState("")
  const [scelto, setScelto] = useState("")
  const [modello, setModello] = useState("")
  const [inCorso, setInCorso] = useState(false)
  const [esito, setEsito] = useState<{
    ok: boolean
    testo: string
    latenzaMs: number
  } | null>(null)

  useEffect(() => {
    fetch("/api/ai/prova")
      .then((r) => r.json())
      .then((d) => {
        if (d.provider) {
          setProvider(d.provider)
          setAttivo(d.attivo)
          setScelto(d.attivo)
          setModello(d.modello ?? "")
        }
      })
      .catch(() => {})
  }, [])

  const def = provider.find((p) => p.nome === scelto)

  async function prova() {
    setInCorso(true)
    setEsito(null)
    try {
      const r = await fetch("/api/ai/prova", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: scelto, modello: modello || null }),
      })
      const d = await r.json()
      setEsito({
        ok: Boolean(d.ok),
        testo: d.ok
          ? `Risposta ricevuta da ${d.modello}: «${d.risposta}»`
          : (d.errore ?? "Errore sconosciuto."),
        latenzaMs: d.latenzaMs ?? 0,
      })
    } catch (e) {
      setEsito({
        ok: false,
        testo: e instanceof Error ? e.message : "Errore imprevisto.",
        latenzaMs: 0,
      })
    } finally {
      setInCorso(false)
    }
  }

  return (
    <section className="scheda p-5 space-y-4">
      <div>
        <h2 className="font-medium">Provider AI</h2>
        <p className="text-sm text-tenue mt-1 leading-relaxed">
          L&apos;AI serve solo a tradurre le richieste in italiano in vincoli
          strutturati: <strong>non genera i turni</strong>, che restano compito del
          solver. Il provider si cambia da <code>AI_PROVIDER</code> in{" "}
          <code>.env.local</code>; qui puoi provarne uno diverso prima di
          modificarlo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="prov" className="text-sm font-medium">
            Provider
          </label>
          <select
            id="prov"
            value={scelto}
            onChange={(e) => {
              setScelto(e.target.value)
              setModello("")
              setEsito(null)
            }}
            className="campo mt-1"
          >
            {provider.map((p) => (
              <option key={p.nome} value={p.nome}>
                {p.etichetta}
                {p.configurato ? "" : " — chiave mancante"}
                {p.nome === attivo ? " (in uso)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="mod" className="text-sm font-medium">
            Modello
          </label>
          <input
            id="mod"
            list="modelli-noti"
            value={modello}
            onChange={(e) => setModello(e.target.value)}
            placeholder={def?.modelloDefault ?? ""}
            className="campo mt-1"
          />
          <datalist id="modelli-noti">
            {(def?.modelliNoti ?? []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      {def?.nota && (
        <p className="text-sm text-tenue rounded-lg bg-avviso-tenue/50 p-3 leading-relaxed">
          {def.nota}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={prova}
          disabled={inCorso || !def?.configurato}
          className="bottone bottone-primario"
          type="button"
        >
          {inCorso ? "Provo…" : "Prova connessione"}
        </button>
        {def && !def.configurato && (
          <span className="text-sm text-avviso">
            Aggiungi la chiave in .env.local e riavvia il server.
          </span>
        )}
      </div>

      {esito && (
        <div
          className={`rounded-lg p-3 text-sm ${
            esito.ok ? "bg-accento-tenue" : "bg-allarme-tenue text-allarme"
          }`}
        >
          {esito.testo}
          {esito.latenzaMs > 0 && (
            <span className="text-tenue"> · {esito.latenzaMs} ms</span>
          )}
        </div>
      )}

      <div className="text-xs text-tenue space-y-1 pt-2 border-t border-bordo">
        <p>Chiavi attese in .env.local, una per provider:</p>
        <p className="font-mono">
          GLM_API_KEY · DEEPSEEK_API_KEY · MISTRAL_API_KEY · MOONSHOT_API_KEY ·
          ANTHROPIC_API_KEY · OPENAI_API_KEY
        </p>
      </div>
    </section>
  )
}
