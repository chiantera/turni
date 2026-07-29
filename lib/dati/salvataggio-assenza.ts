import {
  assenzaCompatibileConSchemaPrecedente,
  type TipoAssenzaCellaPiano,
} from "./stato-cella-piano"

interface NuovaAssenza {
  worker_id: string
  dal: string
  al: string
  tipo: TipoAssenzaCellaPiano
  giornata_intera: boolean
  note?: string
}

interface EsitoInserimento {
  error: { code?: string } | null
}

type InserisciAssenza = (assenza: NuovaAssenza) => Promise<EsitoInserimento>

const ERRORE_SALVATAGGIO = "Impossibile salvare l’assenza."

export async function salvaAssenzaConCompatibilita(
  nuovaAssenza: NuovaAssenza,
  inserisci: InserisciAssenza,
): Promise<void> {
  const inserimento = await inserisci(nuovaAssenza)
  if (!inserimento.error) return

  if (
    inserimento.error.code !== "22P02" ||
    (nuovaAssenza.tipo !== "disciplinare" && nuovaAssenza.tipo !== "studio")
  ) {
    throw new Error(ERRORE_SALVATAGGIO)
  }

  const fallback = await inserisci({
    ...nuovaAssenza,
    ...assenzaCompatibileConSchemaPrecedente(nuovaAssenza.tipo),
  })
  if (fallback.error) throw new Error(ERRORE_SALVATAGGIO)
}
