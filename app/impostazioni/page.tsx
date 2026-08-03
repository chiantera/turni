import { revalidatePath } from "next/cache"

import Navigazione from "@/app/componenti/Navigazione"
import GestioneRuoli from "./GestioneRuoli"
import ProvaAI from "./ProvaAI"
import { creaClientServer } from "@/lib/supabase/server"

export const metadata = { title: "Impostazioni — Turni" }
export const dynamic = "force-dynamic"

const CAMPI_REGOLE = [
  {
    chiave: "riposo_min_ore",
    etichetta: "Riposo minimo fra due turni (h)",
    aiuto: "D.Lgs 66/2003 art. 7: 11 ore consecutive ogni 24. Vieta già da solo il mattino dopo una notte.",
    min: 8,
    max: 24,
  },
  {
    chiave: "riposo_dopo_notte_ore",
    etichetta: "Riposo dopo la notte (h)",
    aiuto: "Il ciclo canonico ne produce 48: la notte finisce alle 07:00 e seguono due giorni di riposo.",
    min: 11,
    max: 96,
  },
  {
    chiave: "max_giorni_consecutivi",
    etichetta: "Massimo giorni consecutivi",
    aiuto: "D.Lgs 66/2003 art. 9: almeno 24 ore di riposo ogni 7 giorni.",
    min: 1,
    max: 13,
  },
  {
    chiave: "max_ore_settimana",
    etichetta: "Massimo ore settimanali",
    aiuto: "Tetto di legge inclusi gli straordinari, in media sul periodo di riferimento.",
    min: 20,
    max: 60,
  },
  {
    chiave: "ore_settimanali_default",
    etichetta: "Ore settimanali di default",
    aiuto: "Applicato ai nuovi lavoratori. 38 = 2 mattini + 2 pomeriggi + 1 notte.",
    min: 1,
    max: 48,
  },
]

const CAMPI_PESI = [
  { chiave: "ore_target", etichetta: "Rispetto del monte ore" },
  { chiave: "pattern_settimanale", etichetta: "Aderenza al ciclo 2+2+1" },
  { chiave: "rotazione_avanti", etichetta: "Rotazione in avanti M→P→N" },
  { chiave: "equita_notti", etichetta: "Equità delle notti" },
  { chiave: "equita_weekend", etichetta: "Equità di weekend e festivi" },
  { chiave: "equita_ore", etichetta: "Equità delle ore" },
  { chiave: "stabilita_postazione", etichetta: "Stabilità di postazione" },
  { chiave: "giorno_isolato", etichetta: "Evita giorni di lavoro isolati" },
  { chiave: "riposo_isolato", etichetta: "Evita riposi isolati" },
  { chiave: "preferenze", etichetta: "Peso delle preferenze" },
]

async function salvaImpostazioni(formData: FormData) {
  "use server"
  const sb = await creaClientServer()

  const regole: Record<string, number> = {}
  for (const c of CAMPI_REGOLE) regole[c.chiave] = Number(formData.get(`r:${c.chiave}`))

  const pesi: Record<string, number> = {}
  for (const c of CAMPI_PESI) pesi[c.chiave] = Number(formData.get(`p:${c.chiave}`))

  await sb.from("settings").upsert([
    { chiave: "regole", valore: regole, aggiornato_il: new Date().toISOString() },
    { chiave: "pesi", valore: pesi, aggiornato_il: new Date().toISOString() },
  ])
  revalidatePath("/impostazioni")
}

export default async function Impostazioni({
  searchParams,
}: {
  searchParams: Promise<{ erroreRuolo?: string }>
}) {
  const sp = await searchParams
  const sb = await creaClientServer()
  const { data } = await sb.from("settings").select("*")
  const mappa = new Map((data ?? []).map((r) => [r.chiave, r.valore]))
  const regole = (mappa.get("regole") ?? {}) as Record<string, number>
  const pesi = (mappa.get("pesi") ?? {}) as Record<string, number>

  return (
    <>
      <Navigazione />
      <main className="flex-1 mx-auto w-full max-w-4xl p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Impostazioni</h1>
        </div>

        <GestioneRuoli errore={sp.erroreRuolo} />

        <form action={salvaImpostazioni} className="space-y-6">
          <section className="scheda p-5 space-y-4">
            <div>
              <h2 className="font-medium">Regole obbligatorie</h2>
              <p className="text-sm text-tenue mt-1">
                Vincoli che il solver non viola mai. Se il piano non li può
                rispettare, lascia un turno scoperto e lo segnala invece di forzarli.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {CAMPI_REGOLE.map((c) => (
                <div key={c.chiave}>
                  <label htmlFor={`r:${c.chiave}`} className="text-sm font-medium">
                    {c.etichetta}
                  </label>
                  <input
                    id={`r:${c.chiave}`}
                    name={`r:${c.chiave}`}
                    type="number"
                    min={c.min}
                    max={c.max}
                    defaultValue={regole[c.chiave] ?? ""}
                    className="campo mt-1"
                  />
                  <p className="text-xs text-tenue mt-1 leading-snug">{c.aiuto}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="scheda p-5 space-y-4">
            <div>
              <h2 className="font-medium">Priorità</h2>
              <p className="text-sm text-tenue mt-1">
                Quanto conta ciascun criterio quando non si può accontentare tutti.
                Valori più alti = più importante. Questi criteri non sono obblighi:
                il solver cerca il miglior compromesso fra loro.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {CAMPI_PESI.map((c) => (
                <div key={c.chiave} className="flex items-center gap-3">
                  <label
                    htmlFor={`p:${c.chiave}`}
                    className="text-sm flex-1"
                  >
                    {c.etichetta}
                  </label>
                  <input
                    id={`p:${c.chiave}`}
                    name={`p:${c.chiave}`}
                    type="number"
                    min={0}
                    max={1000}
                    defaultValue={pesi[c.chiave] ?? 50}
                    className="campo w-24 tabular-nums"
                  />
                </div>
              ))}
            </div>
          </section>

          <button type="submit" className="bottone bottone-primario">
            Salva le impostazioni
          </button>
        </form>

        <ProvaAI />
      </main>
    </>
  )
}
