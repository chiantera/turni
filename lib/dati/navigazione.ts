import { meseCorrente } from "./formato"

export interface VoceNavigazione {
  href: string
  etichetta: string
}

export function vociNavigazione(data = new Date()): VoceNavigazione[] {
  return [
    { href: "/riepilogo", etichetta: "Riepilogo" },
    { href: "/lavoratori", etichetta: "Lavoratori" },
    { href: "/postazioni", etichetta: "Postazioni" },
    { href: "/turni", etichetta: "Turni" },
    { href: "/copertura", etichetta: "Copertura" },
    { href: "/vincoli", etichetta: "Vincoli" },
    { href: "/impostazioni", etichetta: "Impostazioni" },
    { href: `/pianificazione/${meseCorrente(data)}`, etichetta: "Pianifica" },
  ]
}
