import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "./types"

/**
 * Client Supabase lato server, legato ai cookie della richiesta.
 * Le query passano da RLS con l'identità dell'utente collegato.
 */
export async function creaClientServer() {
  const store = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (daImpostare) => {
          try {
            for (const { name, value, options } of daImpostare) {
              store.set(name, value, options)
            }
          } catch {
            // Chiamato da un Server Component: i cookie li aggiorna il
            // middleware, qui si può ignorare senza conseguenze.
          }
        },
      },
    },
  )
}

/** Utente corrente con il suo profilo, oppure null se non autenticato. */
export async function utenteCorrente() {
  const sb = await creaClientServer()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null

  const { data: profilo } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return { user, profilo }
}

export async function ePianificatore() {
  const c = await utenteCorrente()
  return c?.profilo?.ruolo === "admin" || c?.profilo?.ruolo === "pianificatore"
}
