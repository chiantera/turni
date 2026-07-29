"use client"

import Link from "next/link"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react"
import { useRouter } from "next/navigation"

import { GIORNI_BREVI, ore } from "@/lib/dati/formato"
import {
  azioniIntestazioneLavoratore,
  azioniIntestazionePostazione,
} from "@/lib/dati/navigazione"
import {
  aggiornaCellaLavoratore,
  aggiornaCellaPostazione,
  aspettoCellaPiano,
  calcolaModifiche,
  creaLegendaPiano,
  lavoratoriCellaPostazione,
  type AssegnazioneModificabile,
} from "@/lib/dati/modifiche-piano"
import {
  STATI_CELLA_LAVORATORE,
  statoCellaLavoratore,
} from "@/lib/dati/stato-cella-piano"
import { giornoSettimana } from "@/lib/solver/tempo"
import type { Tables } from "@/lib/supabase/types"

interface Props {
  dal: string
  al: string
  vista: "lavoratore" | "postazione"
  giorni: string[]
  festivi: string[]
  lavoratori: Tables<"workers">[]
  turni: Tables<"shift_types">[]
  postazioni: Tables<"positions">[]
  abilitazioni: Tables<"worker_positions">[]
  assegnazioni: Tables<"assignments">[]
  assenze: Tables<"absences">[]
}

type Editor =
  | { tipo: "lavoratore"; workerId: string; data: string }
  | {
      tipo: "postazione"
      positionId: string
      shiftTypeId: string
      data: string
    }

type DettaglioRiga =
  | { tipo: "lavoratore"; workerId: string; top: number; left: number }
  | {
      tipo: "postazione"
      positionId: string
      shiftTypeId: string
      top: number
      left: number
    }

function chiave(workerId: string, data: string) {
  return `${workerId}:${data}`
}

export default function TabellaPianoInterattiva({
  dal,
  al,
  vista: vistaIniziale,
  giorni,
  festivi,
  lavoratori,
  turni,
  postazioni,
  abilitazioni,
  assegnazioni,
  assenze,
}: Props) {
  const router = useRouter()
  const inizialiDaServer = useMemo<AssegnazioneModificabile[]>(
    () =>
      assegnazioni.map((a) => ({
        workerId: a.worker_id,
        data: a.data,
        shiftTypeId: a.shift_type_id,
        positionId: a.position_id,
      })),
    [assegnazioni],
  )
  const [iniziali, setIniziali] = useState(inizialiDaServer)
  const [correnti, setCorrenti] = useState(inizialiDaServer)
  const [vista, setVista] = useState(vistaIniziale)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [dettaglioRiga, setDettaglioRiga] = useState<DettaglioRiga | null>(null)
  const triggerDettaglioRef = useRef<HTMLButtonElement | null>(null)
  const dialogDettaglioRef = useRef<HTMLElement | null>(null)
  const [turnoScelto, setTurnoScelto] = useState("")
  const [postazioneScelta, setPostazioneScelta] = useState("")
  const [lavoratoriScelti, setLavoratoriScelti] = useState<Set<string>>(new Set())
  const [inSalvataggio, setInSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState<string | null>(null)

  const modifiche = useMemo(() => calcolaModifiche(iniziali, correnti), [iniziali, correnti])
  const perLavoratoreGiorno = useMemo(
    () => new Map(correnti.map((a) => [chiave(a.workerId, a.data), a])),
    [correnti],
  )
  const inizialePerLavoratoreGiorno = useMemo(
    () => new Map(iniziali.map((a) => [chiave(a.workerId, a.data), a])),
    [iniziali],
  )
  const perPostTurnoGiorno = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of correnti) {
      if (!a.positionId || !a.shiftTypeId) continue
      const k = `${a.positionId}:${a.shiftTypeId}:${a.data}`
      const ids = m.get(k) ?? []
      ids.push(a.workerId)
      m.set(k, ids)
    }
    return m
  }, [correnti])
  const festiviSet = useMemo(() => new Set(festivi), [festivi])
  const turnoPerId = useMemo(() => new Map(turni.map((t) => [t.id, t])), [turni])
  const postazionePerId = useMemo(
    () => new Map(postazioni.map((p) => [p.id, p])),
    [postazioni],
  )
  const lavoratorePerId = useMemo(
    () => new Map(lavoratori.map((l) => [l.id, l])),
    [lavoratori],
  )
  const postazioniPerLavoratore = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const a of abilitazioni) {
      const ids = m.get(a.worker_id) ?? new Set<string>()
      ids.add(a.position_id)
      m.set(a.worker_id, ids)
    }
    return m
  }, [abilitazioni])
  const assenzePerLavoratore = useMemo(() => {
    const m = new Map<string, Tables<"absences">[]>()
    for (const assenza of assenze) {
      const correnti = m.get(assenza.worker_id) ?? []
      correnti.push(assenza)
      m.set(assenza.worker_id, correnti)
    }
    return m
  }, [assenze])
  const legenda = useMemo(
    () => creaLegendaPiano(postazioni, turni),
    [postazioni, turni],
  )

  const chiudiDettaglio = useCallback((ripristinaFocus = true) => {
    setDettaglioRiga(null)
    if (ripristinaFocus) {
      requestAnimationFrame(() => triggerDettaglioRef.current?.focus())
    }
  }, [])

  useEffect(() => {
    if (!dettaglioRiga) return
    const frame = requestAnimationFrame(() => {
      dialogDettaglioRef.current
        ?.querySelector<HTMLElement>("button, a[href]")
        ?.focus()
    })

    function gestisciTastiera(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault()
        chiudiDettaglio()
        return
      }
      if (evento.key !== "Tab" || !dialogDettaglioRef.current) return

      const elementi = Array.from(
        dialogDettaglioRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href]",
        ),
      )
      if (elementi.length === 0) return
      const primo = elementi[0]
      const ultimo = elementi[elementi.length - 1]
      if (evento.shiftKey && document.activeElement === primo) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primo.focus()
      } else if (!dialogDettaglioRef.current.contains(document.activeElement)) {
        evento.preventDefault()
        primo.focus()
      }
    }

    window.addEventListener("keydown", gestisciTastiera)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", gestisciTastiera)
    }
  }, [chiudiDettaglio, dettaglioRiga])

  function posizioneDettaglio(
    evento: MouseEvent<HTMLButtonElement>,
    altezzaStimata: number,
  ) {
    const rettangolo = evento.currentTarget.getBoundingClientRect()
    const left = Math.max(8, Math.min(rettangolo.left, window.innerWidth - 296))
    const sotto = rettangolo.bottom + 6
    const top =
      sotto + altezzaStimata <= window.innerHeight
        ? sotto
        : Math.max(8, rettangolo.top - altezzaStimata - 6)
    return { top, left }
  }

  function apriDettaglioLavoratore(
    evento: MouseEvent<HTMLButtonElement>,
    workerId: string,
  ) {
    triggerDettaglioRef.current = evento.currentTarget
    setDettaglioRiga({
      tipo: "lavoratore",
      workerId,
      ...posizioneDettaglio(evento, 170),
    })
  }

  function apriDettaglioPostazione(
    evento: MouseEvent<HTMLButtonElement>,
    positionId: string,
    shiftTypeId: string,
  ) {
    triggerDettaglioRef.current = evento.currentTarget
    setDettaglioRiga({
      tipo: "postazione",
      positionId,
      shiftTypeId,
      ...posizioneDettaglio(evento, 240),
    })
  }

  function apriLavoratore(workerId: string, data: string) {
    setDettaglioRiga(null)
    const corrente = perLavoratoreGiorno.get(chiave(workerId, data))
    setTurnoScelto(corrente?.shiftTypeId ?? "")
    setPostazioneScelta(corrente?.positionId ?? "")
    setEditor({ tipo: "lavoratore", workerId, data })
  }

  function apriPostazione(positionId: string, shiftTypeId: string, data: string) {
    setDettaglioRiga(null)
    const ids = lavoratoriCellaPostazione(
      correnti,
      positionId,
      shiftTypeId,
      data,
    )
    setLavoratoriScelti(new Set(ids))
    setEditor({ tipo: "postazione", positionId, shiftTypeId, data })
  }

  function applicaEditorLavoratore() {
    if (!editor || editor.tipo !== "lavoratore") return
    if (!turnoScelto || !postazioneScelta) return
    setCorrenti((precedenti) =>
      aggiornaCellaLavoratore(precedenti, editor.workerId, editor.data, {
        shiftTypeId: turnoScelto,
        positionId: postazioneScelta,
      }),
    )
    chiudiEditor()
  }

  function impostaRiposo() {
    if (!editor || editor.tipo !== "lavoratore") return
    setCorrenti((precedenti) =>
      aggiornaCellaLavoratore(precedenti, editor.workerId, editor.data, null),
    )
    chiudiEditor()
  }

  function applicaEditorPostazione() {
    if (!editor || editor.tipo !== "postazione") return
    setCorrenti((precedenti) =>
      aggiornaCellaPostazione(
        precedenti,
        {
          data: editor.data,
          shiftTypeId: editor.shiftTypeId,
          positionId: editor.positionId,
        },
        [...lavoratoriScelti],
      ),
    )
    chiudiEditor()
  }

  function chiudiEditor() {
    setEditor(null)
    setErrore(null)
    setEsito(null)
  }

  async function salva() {
    if (modifiche.length === 0) return
    setInSalvataggio(true)
    setErrore(null)
    setEsito(null)
    try {
      const risposta = await fetch("/api/piano/assegnazioni", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dal, al, modifiche }),
      })
      const dati = await risposta.json()
      if (!risposta.ok) throw new Error(dati.errore ?? "Salvataggio non riuscito.")
      setIniziali(correnti)
      setEsito(
        `${dati.salvate} ${dati.salvate === 1 ? "modifica salvata" : "modifiche salvate"}. Le due viste sono sincronizzate.`,
      )
      router.refresh()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore imprevisto.")
    } finally {
      setInSalvataggio(false)
    }
  }

  function annulla() {
    setCorrenti(iniziali)
    setEditor(null)
    setErrore(null)
    setEsito(null)
  }

  const intestazioneGiorni = giorni.map((g) => {
    const dow = giornoSettimana(g)
    const speciale = dow === 0 || dow === 6 || festiviSet.has(g)
    return (
      <th
        key={g}
        className={`px-1 py-1 border-b border-bordo text-center font-normal min-w-9 ${speciale ? "bg-avviso-tenue" : ""}`}
        title={`${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}${festiviSet.has(g) ? " · Festivo" : ""}`}
      >
        <div className="text-[10px] text-tenue">{GIORNI_BREVI[dow]}</div>
        <div className="tabular-nums">
          {Number(g.slice(8, 10))}
          <span className="text-[9px] text-tenue">/{g.slice(5, 7)}</span>
        </div>
      </th>
    )
  })

  const azioniDettaglio =
    dettaglioRiga?.tipo === "lavoratore"
      ? azioniIntestazioneLavoratore(dettaglioRiga.workerId)
      : dettaglioRiga?.tipo === "postazione"
        ? azioniIntestazionePostazione(
            dettaglioRiga.positionId,
            dettaglioRiga.shiftTypeId,
          )
        : []
  const titoloDettaglio =
    dettaglioRiga?.tipo === "lavoratore"
      ? `${lavoratorePerId.get(dettaglioRiga.workerId)?.cognome ?? ""} ${lavoratorePerId.get(dettaglioRiga.workerId)?.nome ?? ""}`.trim()
      : dettaglioRiga?.tipo === "postazione"
        ? `${postazionePerId.get(dettaglioRiga.positionId)?.nome ?? ""} · ${turnoPerId.get(dettaglioRiga.shiftTypeId)?.nome ?? ""}`
        : ""
  const descrizioneDettaglio =
    dettaglioRiga?.tipo === "lavoratore"
      ? `${ore(Number(lavoratorePerId.get(dettaglioRiga.workerId)?.ore_settimanali ?? 0))} contrattuali a settimana`
      : dettaglioRiga?.tipo === "postazione"
        ? `${turnoPerId.get(dettaglioRiga.shiftTypeId)?.codice ?? ""} · ${turnoPerId.get(dettaglioRiga.shiftTypeId)?.ora_inizio.slice(0, 5) ?? ""}–${turnoPerId.get(dettaglioRiga.shiftTypeId)?.ora_fine.slice(0, 5) ?? ""}`
        : ""

  return (
    <div className="space-y-3">
      <div className="no-stampa flex flex-wrap items-center gap-3 rounded-lg border border-bordo bg-superficie px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg bg-sfondo p-1 text-sm">
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 transition-colors ${vista === "lavoratore" ? "bg-superficie font-medium shadow-sm" : "text-tenue hover:text-testo"}`}
            onClick={() => {
              setVista("lavoratore")
              setDettaglioRiga(null)
            }}
          >
            per lavoratore
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 transition-colors ${vista === "postazione" ? "bg-superficie font-medium shadow-sm" : "text-tenue hover:text-testo"}`}
            onClick={() => {
              setVista("postazione")
              setDettaglioRiga(null)
            }}
          >
            per postazione
          </button>
        </div>
        <p className="text-sm text-tenue">
          Clicca una cella per modificarla
          {vista === "postazione" ? " e scegliere i lavoratori assegnati" : ""}; clicca
          un&apos;intestazione di riga per aprire i collegamenti contestuali.
        </p>
        <div className="ml-auto flex items-center gap-2">
          {modifiche.length > 0 && (
            <span className="text-xs font-medium text-avviso">
              {modifiche.length} {modifiche.length === 1 ? "modifica" : "modifiche"} non salvate
            </span>
          )}
          <button
            type="button"
            className="bottone py-1.5"
            disabled={inSalvataggio || modifiche.length === 0}
            onClick={annulla}
          >
            Annulla
          </button>
          <button
            type="button"
            className="bottone bottone-primario py-1.5"
            disabled={inSalvataggio || modifiche.length === 0}
            onClick={salva}
          >
            {inSalvataggio ? "Salvo…" : "Salva modifiche"}
          </button>
        </div>
      </div>

      {errore && <div className="scheda p-3 bg-allarme-tenue text-allarme text-sm">{errore}</div>}
      {esito && <div className="scheda p-3 text-accento text-sm">{esito}</div>}

      <section className="scheda overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-superficie text-left font-medium px-3 py-2 border-b border-r border-bordo min-w-44">
                {vista === "lavoratore" ? "Lavoratore" : "Postazione / turno"}
              </th>
              {intestazioneGiorni}
              {vista === "lavoratore" && (
                <>
                  <th className="px-2 py-2 border-b border-l border-bordo text-right font-medium">Ore</th>
                  <th className="px-2 py-2 border-b border-bordo text-right font-medium">Notti</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {vista === "lavoratore"
              ? lavoratori.map((l) => {
                  const assegnazioniLav = correnti.filter((a) => a.workerId === l.id)
                  const oreTotali = assegnazioniLav.reduce((totale, a) => {
                    const t = a.shiftTypeId ? turnoPerId.get(a.shiftTypeId) : null
                    return totale + (t?.conta_nelle_ore ? (t.durata_min * Number(t.peso_ore)) / 60 : 0)
                  }, 0)
                  const notti = assegnazioniLav.filter(
                    (a) => a.shiftTypeId && turnoPerId.get(a.shiftTypeId)?.is_notte,
                  ).length
                  const target = (Number(l.ore_settimanali) * giorni.length) / 7
                  return (
                    <tr key={l.id} className="hover:bg-accento-tenue/40">
                      <td className="sticky left-0 z-10 bg-superficie border-b border-r border-bordo whitespace-nowrap">
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          aria-expanded={
                            dettaglioRiga?.tipo === "lavoratore" &&
                            dettaglioRiga.workerId === l.id
                          }
                          onClick={(evento) => apriDettaglioLavoratore(evento, l.id)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-medium hover:bg-accento-tenue focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accento"
                          title="Apri collegamenti e dati del lavoratore"
                        >
                          <span>{l.cognome} {l.nome}</span>
                          <span aria-hidden="true" className="ml-auto text-xs text-tenue">
                            •••
                          </span>
                        </button>
                      </td>
                      {giorni.map((g) => {
                        const k = chiave(l.id, g)
                        const a = perLavoratoreGiorno.get(k)
                        const iniziale = inizialePerLavoratoreGiorno.get(k)
                        const t = a?.shiftTypeId ? turnoPerId.get(a.shiftTypeId) : null
                        const p = a?.positionId ? postazionePerId.get(a.positionId) : null
                        const aspetto = a ? aspettoCellaPiano(a, postazioni, turni) : null
                        const stato = statoCellaLavoratore({
                          workerId: l.id,
                          data: g,
                          assegnazionePresente: Boolean(a),
                          assenze: assenzePerLavoratore.get(l.id) ?? [],
                        })
                        const turnoAssenza = stato?.shiftTypeId
                          ? turnoPerId.get(stato.shiftTypeId)
                          : null
                        const cambiata =
                          a?.shiftTypeId !== iniziale?.shiftTypeId ||
                          a?.positionId !== iniziale?.positionId
                        const dow = giornoSettimana(g)
                        const speciale = dow === 0 || dow === 6 || festiviSet.has(g)
                        return (
                          <td
                            key={g}
                            className={`relative border-b border-bordo text-center p-0.5 ${speciale && !a ? "bg-avviso-tenue/40" : ""}`}
                          >
                            <button
                              type="button"
                              disabled={inSalvataggio}
                              onClick={() => apriLavoratore(l.id, g)}
                              className="group relative grid h-7 w-full min-w-8 place-items-center rounded hover:bg-accento-tenue focus:outline-none focus:ring-2 focus:ring-accento"
                              title={
                                a
                                  ? `${t?.nome ?? "Turno non disponibile"} · ${p?.nome ?? "Postazione non disponibile"} · clicca per modificare`
                                  : `${stato?.etichetta ?? "Riposo"}${turnoAssenza ? ` · ${turnoAssenza.nome}` : ""} · clicca per assegnare`
                              }
                            >
                              {a ? (
                                <span
                                  className="inline-block h-6 w-6 rounded text-xs font-medium leading-6 text-white shadow-sm transition-transform group-hover:scale-110"
                                  style={{ backgroundColor: aspetto?.colore ?? undefined }}
                                >
                                  {aspetto?.codice ?? "?"}
                                </span>
                              ) : (
                                <span
                                  className={`inline-grid h-6 min-w-6 place-items-center rounded border border-bordo bg-superficie px-0.5 text-xs transition-colors group-hover:border-accento group-hover:text-accento ${stato?.assenza ? "font-medium text-testo" : "text-tenue"}`}
                                >
                                  {stato?.codice ?? "R"}
                                </span>
                              )}
                              {cambiata && (
                                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-avviso" />
                              )}
                            </button>
                          </td>
                        )
                      })}
                      <td
                        className={`px-2 border-b border-l border-bordo text-right tabular-nums ${Math.abs(oreTotali - target) > 8 ? "text-avviso font-medium" : ""}`}
                        title={`Obiettivo ${ore(target)}`}
                      >
                        {ore(oreTotali)}
                      </td>
                      <td className="px-2 border-b border-bordo text-right tabular-nums">{notti}</td>
                    </tr>
                  )
                })
              : postazioni.flatMap((p) =>
                  turni.map((t) => (
                    <tr key={`${p.id}:${t.id}`} className="hover:bg-accento-tenue/40">
                      <td className="sticky left-0 z-10 bg-superficie border-b border-r border-bordo whitespace-nowrap">
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          aria-expanded={
                            dettaglioRiga?.tipo === "postazione" &&
                            dettaglioRiga.positionId === p.id &&
                            dettaglioRiga.shiftTypeId === t.id
                          }
                          onClick={(evento) =>
                            apriDettaglioPostazione(evento, p.id, t.id)
                          }
                          className="flex w-full items-center px-3 py-1.5 text-left hover:bg-accento-tenue focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accento"
                          title="Apri collegamenti a postazione, turno e copertura"
                        >
                          <span
                            className="mr-2 inline-block h-5 w-5 rounded text-center text-[10px] font-medium leading-5 text-white align-middle"
                            style={{ backgroundColor: p.colore }}
                          >
                            {t.codice}
                          </span>
                          <span>{p.nome}</span>
                          <span className="text-tenue"> · {t.nome}</span>
                          <span aria-hidden="true" className="ml-auto pl-2 text-xs text-tenue">
                            •••
                          </span>
                        </button>
                      </td>
                      {giorni.map((g) => {
                        const ids = perPostTurnoGiorno.get(`${p.id}:${t.id}:${g}`) ?? []
                        const dow = giornoSettimana(g)
                        const speciale = dow === 0 || dow === 6 || festiviSet.has(g)
                        const modificata = modifiche.some(
                          (m) =>
                            m.data === g &&
                            (m.positionId === p.id ||
                              inizialePerLavoratoreGiorno.get(chiave(m.workerId, g))?.positionId === p.id),
                        )
                        return (
                          <td
                            key={g}
                            className={`relative border-b border-bordo text-center text-[10px] leading-tight p-0.5 ${speciale ? "bg-avviso-tenue/40" : ""}`}
                          >
                            <button
                              type="button"
                              disabled={inSalvataggio}
                              onClick={() => apriPostazione(p.id, t.id, g)}
                              className="group relative min-h-7 w-full min-w-12 rounded px-1 py-0.5 hover:bg-accento-tenue focus:outline-none focus:ring-2 focus:ring-accento"
                              title="Clicca per modificare i lavoratori assegnati"
                            >
                              {ids.length === 0 ? (
                                <span className="font-bold text-allarme group-hover:text-accento">—</span>
                              ) : (
                                ids.map((id) => (
                                  <div key={id} className="max-w-16 truncate">
                                    {lavoratorePerId.get(id)?.cognome ?? "?"}
                                  </div>
                                ))
                              )}
                              {modificata && (
                                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-avviso" />
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )),
                )}
          </tbody>
        </table>
      </section>

      {(legenda.postazioni.length > 0 || legenda.turni.length > 0) && (
        <section className="no-stampa scheda space-y-3 px-3 py-2.5 text-sm">
          <p className="text-xs text-tenue">
            Il colore identifica la postazione; la lettera identifica il turno.
          </p>
          {legenda.postazioni.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="min-w-20 font-medium">Postazioni</span>
              {legenda.postazioni.map((postazione) => (
                <span key={postazione.id} className="flex items-center gap-1.5 text-tenue">
                  <span
                    className="inline-block h-5 w-5 rounded shadow-sm"
                    style={{ backgroundColor: postazione.colore }}
                  />
                  {postazione.nome}
                </span>
              ))}
            </div>
          )}
          {legenda.turni.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-bordo pt-2.5">
              <span className="min-w-20 font-medium">Turni</span>
              {legenda.turni.map((turno) => (
                <span key={turno.id} className="flex items-center gap-1.5 text-tenue">
                  <span className="inline-block h-5 w-5 rounded border border-bordo bg-superficie text-center text-xs font-medium leading-5 text-testo">
                    {turno.codice}
                  </span>
                  {turno.nome} {turno.oraInizio}–{turno.oraFine} ({(turno.durataMin / 60).toString().replace(".", ",")}h)
                </span>
              ))}
            </div>
          )}
          {vista === "lavoratore" && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-bordo pt-2.5">
              <span className="min-w-20 font-medium">Stati</span>
              {STATI_CELLA_LAVORATORE.map((stato) => (
                <span key={stato.tipo} className="flex items-center gap-1.5 text-tenue">
                  <span className="inline-grid h-5 min-w-5 place-items-center rounded border border-bordo bg-superficie px-0.5 text-xs font-medium text-testo">
                    {stato.codice}
                  </span>
                  {stato.etichetta}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <p className="no-stampa text-xs text-tenue">
        Le modifiche manuali sono persistenti. Rigenerare il piano sostituisce le assegnazioni dell&apos;intervallo selezionato.
      </p>

      {dettaglioRiga && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => chiudiDettaglio()}
          />
          <aside
            ref={dialogDettaglioRef}
            role="dialog"
            aria-label={`Collegamenti per ${titoloDettaglio}`}
            className="fixed z-40 max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-72 overflow-y-auto rounded-xl border border-bordo bg-superficie shadow-2xl"
            style={{ top: dettaglioRiga.top, left: dettaglioRiga.left }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-bordo px-4 py-3">
              <div>
                <div className="font-semibold">{titoloDettaglio}</div>
                <div className="mt-0.5 text-xs text-tenue">{descrizioneDettaglio}</div>
              </div>
              <button
                type="button"
                aria-label="Chiudi dettagli"
                className="rounded px-1.5 py-0.5 text-tenue hover:bg-accento-tenue hover:text-testo focus:outline-none focus:ring-2 focus:ring-accento"
                onClick={() => chiudiDettaglio()}
              >
                ×
              </button>
            </div>
            {modifiche.length > 0 && (
              <p className="border-b border-bordo bg-avviso-tenue px-4 py-2 text-xs text-avviso">
                Hai modifiche non salvate: salvale prima di cambiare pagina.
              </p>
            )}
            <nav aria-label="Collegamenti contestuali" className="p-2">
              {azioniDettaglio.map((azione) => (
                <Link
                  key={azione.href}
                  href={azione.href}
                  onClick={() => chiudiDettaglio(false)}
                  className="flex min-h-10 items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-accento-tenue focus:outline-none focus:ring-2 focus:ring-accento"
                >
                  {azione.etichetta}
                  <span aria-hidden="true" className="text-tenue">
                    →
                  </span>
                </Link>
              ))}
            </nav>
          </aside>
        </>
      )}

      {editor && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) chiudiEditor()
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="titolo-editor-turno"
            className="scheda w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-bordo p-4">
              <div>
                <h2 id="titolo-editor-turno" className="font-semibold">
                  {editor.tipo === "lavoratore" ? "Modifica turno" : "Modifica copertura"}
                </h2>
                <p className="mt-1 text-sm text-tenue">
                  {editor.tipo === "lavoratore"
                    ? `${lavoratorePerId.get(editor.workerId)?.nome ?? ""} ${lavoratorePerId.get(editor.workerId)?.cognome ?? ""} · ${editor.data}`
                    : `${postazionePerId.get(editor.positionId)?.nome ?? ""} · ${turnoPerId.get(editor.shiftTypeId)?.nome ?? ""} · ${editor.data}`}
                </p>
              </div>
              <button type="button" className="bottone px-2 py-1" onClick={chiudiEditor} aria-label="Chiudi">
                ×
              </button>
            </div>

            {editor.tipo === "lavoratore" ? (
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium">
                    Turno
                    <select
                      className="campo mt-1"
                      value={turnoScelto}
                      onChange={(e) => setTurnoScelto(e.target.value)}
                    >
                      <option value="">Scegli…</option>
                      {turni.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.codice} · {t.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Postazione
                    <select
                      className="campo mt-1"
                      value={postazioneScelta}
                      onChange={(e) => setPostazioneScelta(e.target.value)}
                    >
                      <option value="">Scegli…</option>
                      {postazioni
                        .filter((p) => postazioniPerLavoratore.get(editor.workerId)?.has(p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2 border-t border-bordo pt-4">
                  <button type="button" className="bottone text-allarme" onClick={impostaRiposo}>
                    Imposta riposo
                  </button>
                  <button type="button" className="bottone ml-auto" onClick={chiudiEditor}>
                    Annulla
                  </button>
                  <button
                    type="button"
                    className="bottone bottone-primario"
                    disabled={!turnoScelto || !postazioneScelta}
                    onClick={applicaEditorLavoratore}
                  >
                    Applica
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <p className="mb-3 text-sm text-tenue">
                  Selezionare un lavoratore già impegnato nello stesso giorno lo sposta in questa cella.
                </p>
                <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-bordo p-2">
                  {lavoratori
                    .filter((l) => postazioniPerLavoratore.get(l.id)?.has(editor.positionId))
                    .map((l) => (
                      <label
                        key={l.id}
                        className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm hover:bg-accento-tenue"
                      >
                        <input
                          type="checkbox"
                          checked={lavoratoriScelti.has(l.id)}
                          onChange={(e) => {
                            const prossimi = new Set(lavoratoriScelti)
                            if (e.target.checked) prossimi.add(l.id)
                            else prossimi.delete(l.id)
                            setLavoratoriScelti(prossimi)
                          }}
                        />
                        <span>{l.cognome} {l.nome}</span>
                        {perLavoratoreGiorno.get(chiave(l.id, editor.data)) &&
                          !lavoratoriScelti.has(l.id) && (
                            <span className="ml-auto text-xs text-avviso">già assegnato</span>
                          )}
                      </label>
                    ))}
                </div>
                <div className="mt-4 flex justify-end gap-2 border-t border-bordo pt-4">
                  <button type="button" className="bottone" onClick={chiudiEditor}>
                    Annulla
                  </button>
                  <button type="button" className="bottone bottone-primario" onClick={applicaEditorPostazione}>
                    Applica
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
