import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { creaClientServer, utenteCorrente } from "@/lib/supabase/server"
import type { Enums } from "@/lib/supabase/types"

type Ruolo = Enums<"ruolo_utente">

const RUOLI: { valore: Ruolo; etichetta: string; cosa: string }[] = [
  { valore: "admin", etichetta: "Amministratore", cosa: "Tutto, compresi i ruoli" },
  { valore: "pianificatore", etichetta: "Pianificatore", cosa: "Crea e modifica i piani" },
  { valore: "lavoratore", etichetta: "Lavoratore", cosa: "Vede i propri turni pubblicati" },
]

async function assegnaRuolo(formData: FormData) {
  "use server"
  const utente = String(formData.get("utente") ?? "")
  const ruolo = String(formData.get("ruolo") ?? "") as Ruolo

  const sb = await creaClientServer()
  const { error } = await sb.rpc("cambia_ruolo", { p_utente: utente, p_ruolo: ruolo })

  // I codici li solleva la funzione, che è l'unica a conoscere le regole:
  // ripeterle qui significherebbe averne due versioni destinate a divergere.
  if (error) {
    const messaggi: Record<string, string> = {
      NON_AUTORIZZATO: "Solo un amministratore può cambiare i ruoli.",
      RUOLO_PROPRIO: "Non puoi cambiare il tuo ruolo: deve farlo un altro amministratore.",
      UTENTE_NON_TROVATO: "Utente non trovato.",
      ULTIMO_ADMIN: "È l'ultimo amministratore rimasto.",
    }
    const chiave = Object.keys(messaggi).find((k) => error.message.includes(k))
    const messaggio = chiave ? messaggi[chiave] : "Modifica non riuscita."
    redirect(`/impostazioni?erroreRuolo=${encodeURIComponent(messaggio)}`)
  }

  revalidatePath("/impostazioni")
}

export default async function GestioneRuoli({ errore }: { errore?: string }) {
  const corrente = await utenteCorrente()
  // La sezione non si mostra a chi non può usarla. Non è la difesa: quella sta
  // in cambia_ruolo(), che rifiuta comunque. Questa è solo cortesia.
  if (corrente?.profilo?.ruolo !== "admin") return null

  const sb = await creaClientServer()
  const { data: profili } = await sb
    .from("profiles")
    .select("id, nome, ruolo, ruolo_aggiornato_il")
    .order("ruolo")
    .order("nome")

  return (
    <section className="scheda p-5 space-y-4">
      <div>
        <h2 className="font-medium">Chi può fare cosa</h2>
        <p className="text-sm text-tenue mt-1">
          Il tuo ruolo non compare: cambiarlo deve poterlo fare solo un altro
          amministratore, così una rimozione resta sempre una decisione di
          qualcun altro. Ne consegue che uno spazio non resta mai senza.
        </p>
      </div>

      {errore && (
        <p className="rounded-lg bg-allarme-tenue text-allarme text-sm p-3">{errore}</p>
      )}

      <ul className="divide-y">
        {(profili ?? []).map((p) => {
          const suo = p.id === corrente.user.id
          return (
            <li key={p.id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {p.nome ?? "Senza nome"}
                  {suo && <span className="text-tenue font-normal"> — sei tu</span>}
                </div>
                <div className="text-sm text-tenue">
                  {RUOLI.find((r) => r.valore === p.ruolo)?.etichetta ?? p.ruolo}
                  {p.ruolo_aggiornato_il &&
                    ` · dal ${new Date(p.ruolo_aggiornato_il).toLocaleDateString("it-IT")}`}
                </div>
              </div>

              {!suo && (
                <form action={assegnaRuolo} className="flex items-center gap-2 flex-shrink-0">
                  <input type="hidden" name="utente" value={p.id} />
                  <label className="sr-only" htmlFor={`ruolo-${p.id}`}>
                    Ruolo di {p.nome ?? "questo utente"}
                  </label>
                  <select
                    id={`ruolo-${p.id}`}
                    name="ruolo"
                    defaultValue={p.ruolo}
                    className="campo"
                  >
                    {RUOLI.map((r) => (
                      <option key={r.valore} value={r.valore}>
                        {r.etichetta}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="bottone">
                    Applica
                  </button>
                </form>
              )}
            </li>
          )
        })}
      </ul>

      <dl className="text-sm text-tenue space-y-1 pt-2 border-t">
        {RUOLI.map((r) => (
          <div key={r.valore} className="flex gap-2">
            <dt className="font-medium text-inchiostro">{r.etichetta}:</dt>
            <dd>{r.cosa}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
