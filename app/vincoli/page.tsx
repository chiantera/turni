import { revalidatePath } from "next/cache"

import Navigazione from "@/app/componenti/Navigazione"
import Assistente from "./Assistente"
import { dataEstesa, meseCorrente } from "@/lib/dati/formato"
import { creaClientServer } from "@/lib/supabase/server"

export const metadata = { title: "Vincoli — Turni" }
export const dynamic = "force-dynamic"

async function commuta(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  await sb
    .from("constraints")
    .update({ attivo: formData.get("attivo") === "1" })
    .eq("id", String(formData.get("id")))
  revalidatePath("/vincoli")
}

async function elimina(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  await sb.from("constraints").delete().eq("id", String(formData.get("id")))
  revalidatePath("/vincoli")
}

const ETICHETTE: Record<string, string> = {
  indisponibile: "Indisponibilità",
  preferenza: "Preferenza",
  turno_vietato: "Turno vietato",
  postazione_fissa: "Postazione fissa",
  insieme: "Devono stare insieme",
  separati: "Non devono coincidere",
  max_turni: "Massimo turni",
  min_turni: "Minimo turni",
  ore_override: "Monte ore personalizzato",
  copertura_override: "Copertura modificata",
  assegnazione_fissa: "Assegnazione fissa",
}

export default async function Vincoli() {
  const sb = await creaClientServer()
  const { data } = await sb
    .from("constraints")
    .select("*")
    .order("attivo", { ascending: false })
    .order("creato_il", { ascending: false })

  const attivi = (data ?? []).filter((v) => v.attivo)
  const spenti = (data ?? []).filter((v) => !v.attivo)

  return (
    <>
      <Navigazione />
      <main className="flex-1 mx-auto w-full max-w-4xl p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Vincoli</h1>
          <p className="text-sm text-tenue mt-1 max-w-3xl leading-relaxed">
            Regole aggiuntive che il solver deve rispettare, oltre a quelle di legge e
            di contratto già attive per tutti. Gli <strong>obblighi assoluti</strong>{" "}
            non vengono mai violati; le <strong>preferenze</strong> vengono rispettate
            quando possibile.
          </p>
        </div>

        <Assistente mese={meseCorrente()} />

        <section className="space-y-3">
          <h2 className="font-medium">
            Vincoli attivi{" "}
            <span className="text-sm text-tenue font-normal">({attivi.length})</span>
          </h2>

          {attivi.length === 0 && (
            <p className="text-sm text-tenue">
              Nessun vincolo attivo. Il piano userà solo le regole generali.
            </p>
          )}

          {attivi.map((v) => (
            <div key={v.id} className="scheda p-4 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{v.descrizione}</div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-tenue">
                  <span className="px-1.5 py-0.5 rounded bg-bordo/50">
                    {ETICHETTE[v.kind] ?? v.kind}
                  </span>
                  <span className={v.is_hard ? "text-allarme" : ""}>
                    {v.is_hard ? "obbligo assoluto" : "preferenza"}
                  </span>
                  <span>origine: {v.origine}</span>
                  {v.valido_dal && <span>dal {dataEstesa(v.valido_dal)}</span>}
                  {v.valido_al && <span>al {dataEstesa(v.valido_al)}</span>}
                </div>
                {v.testo_originale && (
                  <p className="mt-2 text-xs text-tenue italic">
                    Richiesta originale: «{v.testo_originale}»
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <form action={commuta}>
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="attivo" value="0" />
                  <button type="submit" className="bottone py-1 px-2 text-xs">
                    Disattiva
                  </button>
                </form>
                <form action={elimina}>
                  <input type="hidden" name="id" value={v.id} />
                  <button type="submit" className="text-xs text-allarme underline px-2">
                    Elimina
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>

        {spenti.length > 0 && (
          <details className="scheda p-4">
            <summary className="cursor-pointer text-sm text-tenue">
              {spenti.length} vincoli disattivati
            </summary>
            <div className="mt-3 space-y-2">
              {spenti.map((v) => (
                <div key={v.id} className="flex items-center gap-3 text-sm opacity-60">
                  <span className="flex-1">{v.descrizione}</span>
                  <form action={commuta}>
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="attivo" value="1" />
                    <button type="submit" className="bottone py-1 px-2 text-xs">
                      Riattiva
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </details>
        )}
      </main>
    </>
  )
}
