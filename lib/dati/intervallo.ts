import { spostaMese } from "./formato"
import {
  aggiungiGiorni,
  differenzaGiorni,
  giorniNelMese,
  primoDelMese,
} from "../solver/tempo"

export const MAX_GIORNI_PIANIFICAZIONE = 366

export interface IntervalloPianificazione {
  dal: string
  al: string
}

export class ErroreIntervalloPianificazione extends Error {}

function dataIsoValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const [anno, mese, giorno] = data.split("-").map(Number)
  const d = new Date(Date.UTC(anno, mese - 1, giorno))
  return (
    d.getUTCFullYear() === anno &&
    d.getUTCMonth() + 1 === mese &&
    d.getUTCDate() === giorno
  )
}

export function validaIntervallo(
  dal: string,
  al: string,
  massimoGiorni = MAX_GIORNI_PIANIFICAZIONE,
): IntervalloPianificazione {
  if (!dataIsoValida(dal) || !dataIsoValida(al)) {
    throw new ErroreIntervalloPianificazione("Inserisci date valide nel formato AAAA-MM-GG.")
  }
  const distanza = differenzaGiorni(dal, al)
  if (distanza < 0) {
    throw new ErroreIntervalloPianificazione("La data finale non può precedere quella iniziale.")
  }
  if (distanza + 1 > massimoGiorni) {
    throw new ErroreIntervalloPianificazione(
      `L'intervallo può contenere massimo ${massimoGiorni} giorni.`,
    )
  }
  return { dal, al }
}

export function fineDelMese(data: string): string {
  const inizio = primoDelMese(data)
  return aggiungiGiorni(inizio, giorniNelMese(inizio) - 1)
}

export function intervalloDaParametri({
  mese,
  dal,
  al,
}: {
  mese: string
  dal?: string
  al?: string
}): IntervalloPianificazione {
  if (dal || al) {
    if (!dal || !al) {
      throw new ErroreIntervalloPianificazione("Indica sia la data iniziale sia quella finale.")
    }
    return validaIntervallo(dal, al)
  }
  const inizio = primoDelMese(mese)
  return validaIntervallo(inizio, fineDelMese(inizio))
}

export function intervalloDueMesi(data: string): IntervalloPianificazione {
  const dal = primoDelMese(data)
  return { dal, al: fineDelMese(spostaMese(dal, 1)) }
}

export function giorniIntervallo(dal: string, al: string): string[] {
  validaIntervallo(dal, al)
  const quanti = differenzaGiorni(dal, al) + 1
  return Array.from({ length: quanti }, (_, indice) => aggiungiGiorni(dal, indice))
}

export function mesiIntervallo(dal: string, al: string): string[] {
  validaIntervallo(dal, al)
  const ultimo = primoDelMese(al)
  const mesi: string[] = []
  for (let corrente = primoDelMese(dal); corrente <= ultimo; corrente = spostaMese(corrente, 1)) {
    mesi.push(corrente)
  }
  return mesi
}

export function limitiMensiliIntervallo(dal: string, al: string) {
  return mesiIntervallo(dal, al).map((mese) => ({
    mese,
    dal: dal > mese ? dal : mese,
    al: al < fineDelMese(mese) ? al : fineDelMese(mese),
  }))
}

export function segnalazioneRilevante(
  data: string | null,
  riferimenti: unknown,
  dal: string,
  al: string,
): boolean {
  if (data) return data >= dal && data <= al
  if (!riferimenti || typeof riferimenti !== "object") return true
  const ambito = (riferimenti as Record<string, unknown>).intervallo
  if (!ambito || typeof ambito !== "object") return true
  const valori = ambito as Record<string, unknown>
  return valori.dal === dal && valori.al === al
}
