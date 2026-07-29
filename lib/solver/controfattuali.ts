import { generaPiano, type OpzioniSolver } from "./index"
import { costruisciModello, type DatiIngresso } from "./modello"
import { compilaVincoli } from "./vincoli"

export interface EsitoControfattuale {
  vincoloId: string
  descrizione: string
  slotScopertiPrima: number
  slotScopertiDopo: number
  slotRecuperati: number
  utile: boolean
}

export interface OpzioniControfattuali extends OpzioniSolver {
  massimoEsperimenti?: number
}

/**
 * Esegue esperimenti isolati: nessun piano controfattuale viene salvato.
 *
 * Un vincolo viene considerato rilassabile solo se è una regola rigida
 * esplicita. Le regole sconosciute o gli ID duplicati vengono ignorati; il
 * chiamante deve sempre passare il risultato baseline già prodotto.
 */
export function valutaRilassamenti(
  dati: DatiIngresso,
  baseline: { slotScoperti: number },
  vincoloIds: string[],
  opz: OpzioniControfattuali = {},
): EsitoControfattuale[] {
  if (!Number.isFinite(baseline.slotScoperti) || baseline.slotScoperti < 0) {
    return []
  }
  const slotScopertiPrima = Math.floor(baseline.slotScoperti)
  const richiesto = opz.massimoEsperimenti ?? 3
  const normalizzato = Number.isFinite(richiesto) ? Math.floor(richiesto) : 3
  const massimo = Math.max(0, Math.min(normalizzato, 3))
  const candidati: DatiIngresso["vincoli"] = []
  const visti = new Set<string>()
  const applicati = compilaVincoli(costruisciModello(dati)).applicati

  for (const id of vincoloIds) {
    if (visti.has(id)) continue
    visti.add(id)
    const vincolo = dati.vincoli.find((v) => v.id === id)
    if (!vincolo || !vincolo.isHard || !applicati.has(vincolo.id)) continue
    candidati.push(vincolo)
    if (candidati.length >= massimo) break
  }

  const risultati: EsitoControfattuale[] = []
  for (const vincolo of candidati) {
    const datiRilassati: DatiIngresso = {
      ...dati,
      vincoli: dati.vincoli.filter((v) => v !== vincolo),
    }
    const esito = generaPiano(datiRilassati, {
      seme: opz.seme ?? 1,
      tempoMaxMs: opz.tempoMaxMs ?? 1_000,
    })
    const recuperati = slotScopertiPrima - esito.slotScoperti
    risultati.push({
      vincoloId: vincolo.id,
      descrizione: vincolo.descrizione,
      slotScopertiPrima,
      slotScopertiDopo: esito.slotScoperti,
      slotRecuperati: Math.max(0, recuperati),
      utile: recuperati > 0,
    })
  }
  return risultati
}
