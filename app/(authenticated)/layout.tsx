import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import Navigazione from "@/app/componenti/Navigazione"
import { creaClientServer } from "@/lib/supabase/server"

/**
 * Il guscio delle pagine autenticate.
 *
 * Montava un secondo `<html>`/`<body>` dentro quelli del layout radice: HTML
 * non valido, e soprattutto un `bg-gray-50` fisso che tagliava fuori `/home`
 * dai token del tema e dal tema scuro. Il layout radice fa gia' quel lavoro.
 *
 * La navigazione sta qui e non nella pagina perche' e' proprieta' del gruppo:
 * `/home` era l'unica pagina dell'app senza menu — nove pagine lo montano da
 * se', la pagina di atterraggio no — e chi ci arrivava dopo l'accesso non
 * aveva nessun modo di raggiungere il resto se non indovinando gli indirizzi.
 */
export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await creaClientServer()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  return (
    <>
      <Navigazione />
      {children}
    </>
  )
}
