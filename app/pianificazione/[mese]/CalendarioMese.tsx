"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import {
  MESI_BREVI,
  annoDiMese,
  meseCorrente,
  mesiDellAnno,
  nomeMese,
} from "@/lib/dati/formato"

/**
 * Selettore rapido del mese da pianificare.
 *
 * "Precedente"/"successivo" bastano per muoversi di un mese alla volta, ma
 * raggiungere un mese lontano (l'anno prossimo, sei mesi fa) richiederebbe
 * decine di clic. Questo calendario mostra un anno intero — anno navigabile,
 * mesi in griglia — così qualunque mese è raggiungibile in due clic.
 *
 * Ogni volta che il mese selezionato cambia, il genitore passa una `key`
 * diversa (stesso pattern di SelettoreIntervallo): il componente si
 * rimonta e l'anno visibile riparte da quello del nuovo mese, senza bisogno
 * di sincronizzarlo manualmente con un effect.
 */
export default function CalendarioMese({ mese }: { mese: string }) {
  const router = useRouter()
  const dettaglioRef = useRef<HTMLDetailsElement>(null)
  const [anno, setAnno] = useState(annoDiMese(mese))
  const oggi = meseCorrente()

  // <details> gestisce da solo l'apertura, ma non la chiusura al click fuori
  // o con Esc: senza questo il calendario resterebbe aperto finché l'utente
  // non riclicca esattamente sul pulsante che l'ha aperto.
  useEffect(() => {
    function chiudiSeFuori(evento: MouseEvent) {
      const el = dettaglioRef.current
      if (el?.open && !el.contains(evento.target as Node)) el.open = false
    }
    function chiudiConEsc(evento: KeyboardEvent) {
      const el = dettaglioRef.current
      if (evento.key === "Escape" && el?.open) el.open = false
    }
    document.addEventListener("mousedown", chiudiSeFuori)
    document.addEventListener("keydown", chiudiConEsc)
    return () => {
      document.removeEventListener("mousedown", chiudiSeFuori)
      document.removeEventListener("keydown", chiudiConEsc)
    }
  }, [])

  function vaiAlMese(destinazione: string) {
    if (dettaglioRef.current) dettaglioRef.current.open = false
    router.push(`/pianificazione/${destinazione}`)
  }

  return (
    <details ref={dettaglioRef} className="relative">
      <summary className="bottone cursor-pointer list-none py-1 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true">📅</span>
        <span className="capitalize">{nomeMese(mese)}</span>
      </summary>

      <div className="scheda absolute right-0 z-30 mt-2 w-64 p-3 shadow-lg">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="bottone px-2 py-1"
            onClick={() => setAnno((a) => a - 1)}
            aria-label="Anno precedente"
          >
            ‹
          </button>
          <span className="text-sm font-medium tabular-nums">{anno}</span>
          <button
            type="button"
            className="bottone px-2 py-1"
            onClick={() => setAnno((a) => a + 1)}
            aria-label="Anno successivo"
          >
            ›
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {mesiDellAnno(anno).map((m, indice) => {
            const selezionato = m === mese
            const eOggi = m === oggi
            return (
              <button
                key={m}
                type="button"
                onClick={() => vaiAlMese(m)}
                aria-current={selezionato ? "date" : undefined}
                className={`relative w-full justify-center py-1.5 text-sm capitalize ${
                  selezionato ? "bottone bottone-primario" : "bottone"
                }`}
              >
                {MESI_BREVI[indice]}
                {eOggi && !selezionato && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accento"
                  />
                )}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="bottone mt-3 w-full justify-center py-1 text-xs"
          onClick={() => vaiAlMese(oggi)}
        >
          Torna a oggi
        </button>
      </div>
    </details>
  )
}
