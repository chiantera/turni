"use client"

import { useState } from "react"

/**
 * Bottone a due passi per le azioni che è meglio non fare per sbaglio.
 *
 * Deliberatamente NON usa `confirm()`: la finestra nativa blocca il thread del
 * browser, non è stilabile, e ferma qualunque automazione (compresi i test).
 * Due click su un bottone che cambia etichetta ottengono lo stesso risultato
 * restando dentro la pagina.
 *
 * Va messo dentro un `<form action={...}>`: il primo click è un `button` che
 * non invia nulla, il secondo è il `submit` vero.
 */
export default function BottoneConferma({
  etichetta,
  conferma,
  className = "bottone",
}: {
  etichetta: string
  conferma: string
  className?: string
}) {
  const [inAttesa, setInAttesa] = useState(false)

  if (!inAttesa) {
    return (
      <button type="button" className={className} onClick={() => setInAttesa(true)}>
        {etichetta}
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="submit" className={`${className} text-allarme`} autoFocus>
        {conferma}
      </button>
      <button
        type="button"
        className="text-xs text-tenue underline"
        onClick={() => setInAttesa(false)}
      >
        annulla
      </button>
    </span>
  )
}
