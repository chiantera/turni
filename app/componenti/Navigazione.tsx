import Link from "next/link"
import { redirect } from "next/navigation"

import { creaClientServer, utenteCorrente } from "@/lib/supabase/server"
import { vociNavigazione } from "@/lib/dati/navigazione"

async function esci() {
  "use server"
  const sb = await creaClientServer()
  await sb.auth.signOut()
  redirect("/accedi")
}

export default async function Navigazione() {
  const corrente = await utenteCorrente()
  const ruolo = corrente?.profilo?.ruolo
  const voci = vociNavigazione()

  return (
    <header className="no-stampa border-b border-bordo bg-superficie">
      <nav className="mx-auto max-w-[1600px] px-4 h-14 flex items-center gap-1">
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accento-tenue [&::-webkit-details-marker]:hidden">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4"
            >
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Menu
            <span aria-hidden="true" className="text-xs text-tenue transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>

          <div className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-bordo bg-superficie p-1.5 shadow-xl">
            {voci.map((voce) => (
              <Link
                key={voce.href}
                href={voce.href}
                className={`block rounded-lg px-3 py-2 text-sm hover:bg-accento-tenue ${
                  voce.etichetta === "Pianifica" ? "font-medium text-accento" : ""
                }`}
              >
                {voce.etichetta}
              </Link>
            ))}
          </div>
        </details>

        <div className="ml-auto flex items-center gap-3 text-sm text-tenue">
          <span className="hidden sm:inline">
            {corrente?.profilo?.nome ?? corrente?.user.email}
            {ruolo && ruolo !== "lavoratore" ? ` · ${ruolo}` : ""}
          </span>
          <form action={esci}>
            <button type="submit" className="bottone py-1 px-3">
              Esci
            </button>
          </form>
        </div>
      </nav>
    </header>
  )
}
