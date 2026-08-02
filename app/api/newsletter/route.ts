import { NextResponse } from "next/server"

import { normalizzaEmail } from "@/lib/dati/newsletter"
import { creaClientServer } from "@/lib/supabase/server"

export const runtime = "nodejs"

/**
 * Iscrizione alla newsletter dalla landing page.
 *
 * È l'unico endpoint del progetto aperto a chi non ha una sessione, quindi
 * non si fida di nulla di ciò che riceve. La scrittura passa dalla funzione
 * `iscrivi_newsletter()`: la tabella non ha policy di scrittura, così una
 * chiave pubblicabile — che sta nel bundle del browser — non basta a inserirvi
 * righe.
 *
 * La risposta è identica per un indirizzo nuovo e per uno già iscritto: dire
 * la differenza permetterebbe a un estraneo di scoprire chi è in elenco.
 */
export async function POST(req: Request) {
  const corpo = await req.json().catch(() => ({}))

  // Campo esca: invisibile a chi guarda la pagina, irresistibile per i bot che
  // compilano ogni input che trovano. Se è pieno fingiamo che sia andata bene,
  // così chi automatizza non impara da quale campo è stato scoperto.
  if (typeof corpo.azienda === "string" && corpo.azienda.trim() !== "") {
    return NextResponse.json({ ok: true })
  }

  const email = normalizzaEmail(corpo.email)
  if (!email) {
    return NextResponse.json(
      { errore: "Controlla l'indirizzo: non sembra un'email valida." },
      { status: 400 },
    )
  }

  const sb = await creaClientServer()
  const { error } = await sb.rpc("iscrivi_newsletter", { p_email: email })
  if (error) {
    // Il messaggio di Postgres resta nei log del server: all'utente non serve,
    // e può raccontare più del dovuto sullo schema.
    console.error("Iscrizione newsletter fallita:", error.message)
    return NextResponse.json(
      { errore: "Non siamo riusciti a registrare l'iscrizione. Riprova più tardi." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
