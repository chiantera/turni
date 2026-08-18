export interface VoceNavigazione {
  href: string
  etichetta: string
}

export interface AzioneIntestazionePiano {
  etichetta: string
  href: string
}

export function deveConfermareNavigazioneContestuale(
  numeroModifiche: number,
): boolean {
  return numeroModifiche > 0
}

export function azioniIntestazioneLavoratore(
  workerId: string,
): AzioneIntestazionePiano[] {
  return [
    {
      etichetta: "Dati lavoratore",
      href: `/lavoratori#lavoratore-${encodeURIComponent(workerId)}`,
    },
    { etichetta: "Riepilogo", href: "/riepilogo" },
  ]
}

export function azioniIntestazionePostazione(
  positionId: string,
  shiftTypeId: string,
): AzioneIntestazionePiano[] {
  return [
    {
      etichetta: "Dati postazione",
      href: `/postazioni#postazione-${encodeURIComponent(positionId)}`,
    },
    {
      etichetta: "Dati turno",
      href: `/turni#turno-${encodeURIComponent(shiftTypeId)}`,
    },
    {
      etichetta: "Copertura",
      href: `/copertura#copertura-${encodeURIComponent(positionId)}-${encodeURIComponent(shiftTypeId)}`,
    },
    { etichetta: "Riepilogo", href: "/riepilogo" },
  ]
}

export function vociNavigazione(): VoceNavigazione[] {
  return [
    { href: "/riepilogo", etichetta: "Riepilogo" },
    { href: "/lavoratori", etichetta: "Lavoratori" },
    { href: "/postazioni", etichetta: "Postazioni" },
    { href: "/turni", etichetta: "Turni" },
    { href: "/copertura", etichetta: "Copertura" },
    { href: "/festivita", etichetta: "Festività" },
    { href: "/vincoli", etichetta: "Vincoli" },
    { href: "/impostazioni", etichetta: "Impostazioni" },
  ]
}

export function destinazioneDopoAccesso(parametri: {
  da?: string
  dal?: string
  al?: string
}): string {
  const { da, dal, al } = parametri
  if (!da?.startsWith("/") || da.startsWith("//")) return "/"
  if (!dal && !al) return da
  const query = new URLSearchParams()
  if (dal) query.set("dal", dal)
  if (al) query.set("al", al)
  return `${da}${da.includes("?") ? "&" : "?"}${query}`
}
