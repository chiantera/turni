"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { meseCorrente } from "@/lib/dati/formato"
import {
  ErroreIntervalloPianificazione,
  fineDelMese,
  intervalloDueMesi,
  validaIntervallo,
} from "@/lib/dati/intervallo"
import { primoDelMese } from "@/lib/solver/tempo"

function percorso(dal: string, al: string): string {
  return `/pianificazione/${primoDelMese(dal)}?dal=${dal}&al=${al}`
}

export default function SelettoreIntervallo({ dal, al }: { dal: string; al: string }) {
  const router = useRouter()
  const [inizio, setInizio] = useState(dal)
  const [fine, setFine] = useState(al)
  const [errore, setErrore] = useState<string | null>(null)


  function apriMeseCorrente() {
    const corrente = meseCorrente()
    router.push(`/pianificazione/${corrente}`)
  }

  function apriDueMesi() {
    const intervallo = intervalloDueMesi(dal)
    router.push(percorso(intervallo.dal, intervallo.al))
  }

  function applica(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    try {
      const intervallo = validaIntervallo(inizio, fine)
      setErrore(null)
      router.push(percorso(intervallo.dal, intervallo.al))
    } catch (e) {
      setErrore(
        e instanceof ErroreIntervalloPianificazione
          ? e.message
          : "Intervallo non valido.",
      )
    }
  }

  const meseSelezionato = dal === meseCorrente() && al === fineDelMese(dal)
  const dueMesiSelezionati = (() => {
    const intervallo = intervalloDueMesi(dal)
    return intervallo.dal === dal && intervallo.al === al
  })()

  return (
    <section className="no-stampa scheda p-3">
      <form onSubmit={applica} className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            className={`bottone ${meseSelezionato ? "bottone-primario" : ""}`}
            onClick={apriMeseCorrente}
          >
            Mese corrente
          </button>
          <button
            type="button"
            className={`bottone ${dueMesiSelezionati ? "bottone-primario" : ""}`}
            onClick={apriDueMesi}
          >
            Due mesi
          </button>
        </div>
        <label className="text-xs text-tenue">
          Dal
          <input
            type="date"
            className="campo mt-1 block py-1.5"
            value={inizio}
            onChange={(e) => setInizio(e.target.value)}
            required
          />
        </label>
        <label className="text-xs text-tenue">
          Al
          <input
            type="date"
            className="campo mt-1 block py-1.5"
            value={fine}
            onChange={(e) => setFine(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="bottone">
          Applica intervallo
        </button>
        <span className="pb-2 text-xs text-tenue">Date incluse · massimo 366 giorni</span>
      </form>
      {errore && <p className="mt-2 text-sm text-allarme">{errore}</p>}
    </section>
  )
}
