export interface AssegnazioneModificabile {
  workerId: string
  data: string
  shiftTypeId: string | null
  positionId: string | null
}

export class ErroreModifichePiano extends Error {}

function chiaveCella(a: Pick<AssegnazioneModificabile, "workerId" | "data">): string {
  return `${a.workerId}:${a.data}`
}

function stessaAssegnazione(
  a: AssegnazioneModificabile | undefined,
  b: AssegnazioneModificabile | undefined,
): boolean {
  return a?.shiftTypeId === b?.shiftTypeId && a?.positionId === b?.positionId
}

export function codificaScelta(shiftTypeId: string, positionId: string): string {
  return `${shiftTypeId}|${positionId}`
}

export function decodificaScelta(
  valore: string,
): Pick<AssegnazioneModificabile, "shiftTypeId" | "positionId"> | null {
  if (!valore) return null
  const separatore = valore.indexOf("|")
  if (separatore <= 0 || separatore === valore.length - 1) {
    throw new ErroreModifichePiano("Scelta turno/postazione non valida.")
  }
  return {
    shiftTypeId: valore.slice(0, separatore),
    positionId: valore.slice(separatore + 1),
  }
}

export function calcolaModifiche(
  iniziali: AssegnazioneModificabile[],
  correnti: AssegnazioneModificabile[],
): AssegnazioneModificabile[] {
  const inizialePerCella = new Map(iniziali.map((a) => [chiaveCella(a), a]))
  const correntePerCella = new Map(correnti.map((a) => [chiaveCella(a), a]))
  const modifiche = correnti.filter(
    (a) => !stessaAssegnazione(inizialePerCella.get(chiaveCella(a)), a),
  )

  for (const a of iniziali) {
    if (!correntePerCella.has(chiaveCella(a))) {
      modifiche.push({
        workerId: a.workerId,
        data: a.data,
        shiftTypeId: null,
        positionId: null,
      })
    }
  }
  return modifiche
}

export function aggiornaCellaLavoratore(
  correnti: AssegnazioneModificabile[],
  workerId: string,
  data: string,
  scelta: Pick<AssegnazioneModificabile, "shiftTypeId" | "positionId"> | null,
): AssegnazioneModificabile[] {
  const prossime = correnti.filter(
    (a) => !(a.workerId === workerId && a.data === data),
  )
  if (scelta) prossime.push({ workerId, data, ...scelta })
  return prossime
}

export function aggiornaCellaPostazione(
  correnti: AssegnazioneModificabile[],
  cella: Pick<AssegnazioneModificabile, "data" | "shiftTypeId" | "positionId">,
  workerIds: string[],
): AssegnazioneModificabile[] {
  const selezionati = new Set(workerIds)
  const prossime = correnti.filter(
    (a) =>
      !(
        a.data === cella.data &&
        a.shiftTypeId === cella.shiftTypeId &&
        a.positionId === cella.positionId
      ) &&
      !(a.data === cella.data && selezionati.has(a.workerId)),
  )
  for (const workerId of workerIds) {
    prossime.push({ workerId, ...cella })
  }
  return prossime
}

export function lavoratoriCellaPostazione(
  correnti: AssegnazioneModificabile[],
  positionId: string,
  shiftTypeId: string,
  data: string,
): string[] {
  return correnti
    .filter(
      (a) =>
        a.positionId === positionId &&
        a.shiftTypeId === shiftTypeId &&
        a.data === data,
    )
    .map((a) => a.workerId)
}

function dataIsoValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const d = new Date(`${data}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data
}

export function validaModifichePiano(
  mese: string,
  valore: unknown,
): AssegnazioneModificabile[] {
  if (!/^\d{4}-\d{2}-01$/.test(mese) || !dataIsoValida(mese)) {
    throw new ErroreModifichePiano("Mese non valido.")
  }
  if (!Array.isArray(valore) || valore.length > 1000) {
    throw new ErroreModifichePiano("Elenco modifiche non valido.")
  }

  const viste = new Set<string>()
  return valore.map((grezzo) => {
    if (!grezzo || typeof grezzo !== "object") {
      throw new ErroreModifichePiano("Modifica non valida.")
    }
    const r = grezzo as Record<string, unknown>
    const workerId = typeof r.workerId === "string" ? r.workerId.trim() : ""
    const data = typeof r.data === "string" ? r.data : ""
    const shiftTypeId = typeof r.shiftTypeId === "string" ? r.shiftTypeId.trim() : null
    const positionId = typeof r.positionId === "string" ? r.positionId.trim() : null

    if (!workerId || !dataIsoValida(data)) {
      throw new ErroreModifichePiano("Lavoratore o data non validi.")
    }
    if (data.slice(0, 7) !== mese.slice(0, 7)) {
      throw new ErroreModifichePiano(`La data ${data} è fuori dal mese pianificato.`)
    }
    if (Boolean(shiftTypeId) !== Boolean(positionId)) {
      throw new ErroreModifichePiano("Turno e postazione devono essere indicati insieme.")
    }

    const modifica: AssegnazioneModificabile = {
      workerId,
      data,
      shiftTypeId,
      positionId,
    }
    const chiave = chiaveCella(modifica)
    if (viste.has(chiave)) {
      throw new ErroreModifichePiano("Una cella può essere modificata una sola volta.")
    }
    viste.add(chiave)
    return modifica
  })
}

export function preparaSalvataggioModifiche(
  scheduleId: string,
  modifiche: AssegnazioneModificabile[],
) {
  const daSalvare = modifiche
    .filter((m) => m.shiftTypeId && m.positionId)
    .map((m) => ({
      schedule_id: scheduleId,
      worker_id: m.workerId,
      data: m.data,
      shift_type_id: m.shiftTypeId as string,
      position_id: m.positionId as string,
      origine: "manuale" as const,
      bloccato: true,
    }))
  const daRimuovere = modifiche
    .filter((m) => !m.shiftTypeId)
    .map((m) => ({ workerId: m.workerId, data: m.data }))

  return { daSalvare, daRimuovere }
}
