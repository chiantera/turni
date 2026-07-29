import { redirect } from "next/navigation"

import { percorsoPianificazioneCorrente } from "@/lib/dati/formato"

export const dynamic = "force-dynamic"

export default function PaginaIniziale() {
  redirect(percorsoPianificazioneCorrente())
}
