import type { DatiIngresso } from "./modello"

/** Serializzazione canonica usata per riconoscere diagnostiche obsolete. */
export function serializzaDatiPerImpronta(dati: DatiIngresso): string {
  const dal = dati.dal ?? `${dati.mese.slice(0, 7)}-01`
  const al = dati.al
  const assegnazioniEsistenti = dati.assegnazioniEsistenti.filter((assegnazione) => {
    if (assegnazione.bloccato) return true
    if (al) {
      return assegnazione.data < dal || assegnazione.data > al
    }
    return assegnazione.data.slice(0, 7) !== dati.mese.slice(0, 7)
  })
  return serializzaOrdinato({ ...dati, assegnazioniEsistenti })
}

function serializzaOrdinato(valore: unknown): string {
  if (valore === null || typeof valore !== "object") return JSON.stringify(valore)
  if (Array.isArray(valore)) {
    return `[${valore.map((elemento) => serializzaOrdinato(elemento)).join(",")}]`
  }
  const oggetto = valoreComeOggetto(valore)
  return `{${Object.keys(oggetto)
    .sort()
    .map((chiave) => `${JSON.stringify(chiave)}:${serializzaOrdinato(oggetto[chiave])}`)
    .join(",")}}`
}

function valoreComeOggetto(valore: object): Record<string, unknown> {
  return valore as Record<string, unknown>
}
