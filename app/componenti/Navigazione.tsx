import Link from "next/link"
import { redirect } from "next/navigation"

import { creaClientServer, utenteCorrente } from "@/lib/supabase/server"
import { meseCorrente } from "@/lib/dati/formato"

const VOCI = [
  { href: "/lavoratori", etichetta: "Lavoratori" },
  { href: "/postazioni", etichetta: "Postazioni" },
  { href: "/turni", etichetta: "Turni" },
  { href: "/copertura", etichetta: "Copertura" },
  { href: "/vincoli", etichetta: "Vincoli" },
  { href: "/impostazioni", etichetta: "Impostazioni" },
]

async function esci() {
  "use server"
  const sb = await creaClientServer()
  await sb.auth.signOut()
  redirect("/accedi")
}

export default async function Navigazione() {
  const corrente = await utenteCorrente()
  const ruolo = corrente?.profilo?.ruolo

  return (
    <header className="no-stampa border-b border-bordo bg-superficie">
      <nav className="mx-auto max-w-[1600px] px-4 h-14 flex items-center gap-1">
        <Link href="/" className="font-semibold mr-4">
          Turni
        </Link>

        <div className="flex items-center gap-1 overflow-x-auto">
          {VOCI.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              className="px-3 py-1.5 rounded-lg text-sm hover:bg-accento-tenue whitespace-nowrap"
            >
              {v.etichetta}
            </Link>
          ))}
          <Link
            href={`/pianificazione/${meseCorrente()}`}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accento text-white whitespace-nowrap"
          >
            Pianifica
          </Link>
        </div>

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
