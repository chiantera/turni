import Link from "next/link"

import {
  passoSuccessivo,
  type PassoConfigurazione,
} from "@/lib/dati/primi-passi"

function Spunta({ fatto }: { fatto: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs ${
        fatto
          ? "border-accento bg-accento text-white"
          : "border-bordo text-tenue"
      }`}
    >
      {fatto ? "✓" : ""}
    </span>
  )
}

function Riga({
  passo,
  prossimo,
}: {
  passo: PassoConfigurazione
  prossimo: boolean
}) {
  return (
    <li
      className={`flex gap-3 rounded-lg p-3 ${
        prossimo ? "bg-accento-tenue" : ""
      }`}
    >
      <Spunta fatto={passo.fatto} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{passo.titolo}</span>
          <span className="text-xs text-tenue">
            {passo.fatto ? "fatto" : prossimo ? "tocca a questo" : "da fare"}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-tenue">{passo.spiegazione}</p>
        <p
          className={`mt-1 text-sm ${passo.fatto ? "text-tenue" : "text-testo"}`}
        >
          {passo.dettaglio}
        </p>
      </div>
      <Link
        href={passo.href}
        className={`self-center whitespace-nowrap text-sm ${
          prossimo ? "bottone bottone-primario" : "bottone"
        }`}
      >
        {passo.fatto ? "Rivedi" : passo.azione}
      </Link>
    </li>
  )
}

/**
 * La guida alla configurazione, con lo stato reale accanto a ogni passo.
 *
 * Si apre da sola finché manca qualcosa e si richiude quando non manca più
 * niente: chi arriva la prima volta la trova aperta, chi usa l'app da un mese
 * non se la ritrova più fra i piedi. Nessuna preferenza da salvare — lo stato
 * della configurazione è già la risposta.
 */
export default function PrimiPassi({ passi }: { passi: PassoConfigurazione[] }) {
  const prossimo = passoSuccessivo(passi)
  const fatti = passi.filter((p) => p.fatto).length

  return (
    <details open={prossimo !== null} className="scheda mb-8 p-4 sm:p-6">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold">
            {prossimo ? "Da dove si comincia" : "Configurazione completa"}
          </h2>
          <span className="rounded-full bg-accento-tenue px-2 py-0.5 text-xs text-accento">
            {fatti} di {passi.length}
          </span>
          <span className="ml-auto text-sm text-tenue">
            {prossimo ? "nascondi" : "mostra i passaggi"}
          </span>
        </div>
        <p className="mt-1 text-sm text-tenue">
          {prossimo
            ? `Cinque passaggi separano un'installazione vuota dal primo piano. Il prossimo è «${prossimo.titolo}».`
            : "Tutto configurato. I passaggi restano qui come promemoria di dove si cambia cosa."}
        </p>
      </summary>

      <ul className="mt-4 space-y-1">
        {passi.map((passo) => (
          <Riga
            key={passo.id}
            passo={passo}
            prossimo={passo.id === prossimo?.id}
          />
        ))}
      </ul>
    </details>
  )
}
