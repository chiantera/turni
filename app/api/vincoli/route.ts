import { NextResponse } from "next/server"

import { KIND_VINCOLO } from "@/lib/ai/dsl"
import { creaClientServer, ePianificatore } from "@/lib/supabase/server"

export const runtime = "nodejs"

/**
 * Salva i vincoli CONFERMATI dall'utente.
 *
 * Endpoint separato da quello di estrazione, e questo è deliberato: l'AI non
 * ha mai un percorso diretto verso il database. Quello che arriva qui è già
 * passato sotto gli occhi di una persona che ha premuto "conferma".
 */
export async function POST(req: Request) {
  if (!(await ePianificatore())) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 403 })
  }

  const corpo = await req.json().catch(() => ({}))
  const vincoli = Array.isArray(corpo.vincoli) ? corpo.vincoli : []
  if (vincoli.length === 0) {
    return NextResponse.json({ errore: "Nessun vincolo da salvare." }, { status: 400 })
  }

  // Riconvalida lato server: il client potrebbe aver alterato il payload, e
  // fidarsi di ciò che torna dal browser è sempre un errore.
  const righe = []
  for (const v of vincoli) {
    if (!KIND_VINCOLO.includes(v.kind)) {
      return NextResponse.json(
        { errore: `Tipo di vincolo non ammesso: "${v.kind}".` },
        { status: 400 },
      )
    }
    if (typeof v.descrizione !== "string" || v.descrizione.trim() === "") {
      return NextResponse.json({ errore: "Ogni vincolo deve avere una descrizione." }, { status: 400 })
    }
    righe.push({
      origine: (corpo.origine === "ai" ? "ai" : "manuale") as "ai" | "manuale",
      testo_originale: typeof corpo.testo === "string" ? corpo.testo : null,
      kind: v.kind,
      params: v.params ?? {},
      is_hard: Boolean(v.is_hard),
      peso: Number(v.peso) || 50,
      descrizione: v.descrizione.trim(),
      valido_dal: v.valido_dal || null,
      valido_al: v.valido_al || null,
      attivo: true,
    })
  }

  const sb = await creaClientServer()
  const { error } = await sb.from("constraints").insert(righe)
  if (error) return NextResponse.json({ errore: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, salvati: righe.length })
}
