import type { Enums } from "@/lib/supabase/types"

export type TipoAssenzaCellaPiano = Enums<"tipo_assenza">

export interface AssenzaCellaPiano {
  worker_id: string
  dal: string
  al: string
  tipo: TipoAssenzaCellaPiano
  giornata_intera: boolean
  shift_type_id: string | null
  note: string | null
}

export interface StatoCellaLavoratore {
  codice: string
  etichetta: string
  tipo: "riposo" | TipoAssenzaCellaPiano
  assenza: boolean
  shiftTypeId: string | null
}

export const STATI_CELLA_LAVORATORE: ReadonlyArray<
  Pick<StatoCellaLavoratore, "tipo" | "codice" | "etichetta" | "assenza">
> = [
  { tipo: "riposo", codice: "R", etichetta: "Riposo", assenza: false },
  { tipo: "ferie", codice: "F", etichetta: "Ferie", assenza: true },
  { tipo: "malattia", codice: "🤒", etichetta: "Malattia", assenza: true },
  { tipo: "disciplinare", codice: "D", etichetta: "Disciplinare", assenza: true },
  { tipo: "studio", codice: "📚", etichetta: "Permesso per studiare", assenza: true },
  // `C` e' la sigla che il coordinatore usa gia' sui propri prospetti: la
  // griglia si legge come la sua.
  { tipo: "congedo", codice: "C", etichetta: "Congedo parentale", assenza: true },
  { tipo: "altro", codice: "A", etichetta: "Altro", assenza: true },
]

export function etichettaAccessibileCellaLavoratore({
  lavoratore,
  data,
  stato,
  turno,
  postazione,
}: {
  lavoratore: string
  data: string
  stato?: string
  turno?: string
  postazione?: string
}): string {
  const contenuto =
    stato ??
    `${turno ?? "Turno non disponibile"} · ${postazione ?? "Postazione non disponibile"}`
  return `${lavoratore}, ${data}: ${contenuto}. Clicca per modificare.`
}

const STATI_LEGACY: ReadonlyArray<
  Pick<StatoCellaLavoratore, "tipo" | "codice" | "etichetta" | "assenza">
> = [
  { tipo: "permesso", codice: "P", etichetta: "Permesso", assenza: true },
  { tipo: "l104", codice: "104", etichetta: "Legge 104", assenza: true },
  { tipo: "formazione", codice: "📚", etichetta: "Formazione", assenza: true },
]

const STATO_PER_TIPO = new Map(
  [...STATI_CELLA_LAVORATORE, ...STATI_LEGACY].map((stato) => [stato.tipo, stato]),
)

const NOTE_COMPATIBILITA = {
  disciplinare: "[stato-piano:disciplinare]",
  studio: "[stato-piano:studio]",
} as const

export function assenzaCompatibileConSchemaPrecedente(
  tipo: "disciplinare" | "studio",
): { tipo: "altro" | "formazione"; note: string } {
  return tipo === "disciplinare"
    ? { tipo: "altro", note: NOTE_COMPATIBILITA.disciplinare }
    : { tipo: "formazione", note: NOTE_COMPATIBILITA.studio }
}

function tipoEffettivoAssenza(assenza: AssenzaCellaPiano): TipoAssenzaCellaPiano {
  if (assenza.tipo === "altro" && assenza.note === NOTE_COMPATIBILITA.disciplinare) {
    return "disciplinare"
  }
  if (assenza.tipo === "formazione" && assenza.note === NOTE_COMPATIBILITA.studio) {
    return "studio"
  }
  return assenza.tipo
}

export function statoCellaLavoratore({
  workerId,
  data,
  assegnazionePresente,
  assenze,
}: {
  workerId: string
  data: string
  assegnazionePresente: boolean
  assenze: AssenzaCellaPiano[]
}): StatoCellaLavoratore | null {
  if (assegnazionePresente) return null

  const assenzeDellaData = assenze.filter(
    (candidata) =>
      candidata.worker_id === workerId && candidata.dal <= data && candidata.al >= data,
  )
  const assenza =
    assenzeDellaData.find((candidata) => candidata.giornata_intera) ?? assenzeDellaData[0]
  if (assenza) {
    const stato = STATO_PER_TIPO.get(tipoEffettivoAssenza(assenza))
    if (stato) return { ...stato, shiftTypeId: assenza.shift_type_id }
  }

  const riposo = STATI_CELLA_LAVORATORE[0]
  return { ...riposo, shiftTypeId: null }
}
