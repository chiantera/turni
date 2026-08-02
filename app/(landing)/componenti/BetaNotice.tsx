import { LANDING_COPY } from "@/lib/landing/copy"

/**
 * Sostituisce la sezione delle testimonianze, che citava clienti inventati.
 * Dire in che stato è il prodotto vale più di un apprezzamento fabbricato: chi
 * valuta una beta vuole sapere cosa manca, non leggere cinque stelle.
 */
export default function BetaNotice() {
  const { beta } = LANDING_COPY

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
          {beta.etichetta}
        </span>

        <h2 className="text-3xl md:text-4xl font-semibold mt-4 mb-4">
          {beta.headline}
        </h2>
        <p className="text-lg text-gray-600 mb-10 max-w-2xl leading-relaxed">
          {beta.testo}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Elenco titolo={beta.pronti.titolo} voci={beta.pronti.voci} segno="✓" tono="pronto" />
          <Elenco titolo={beta.mancano.titolo} voci={beta.mancano.voci} segno="—" tono="manca" />
        </div>
      </div>
    </section>
  )
}

function Elenco({
  titolo,
  voci,
  segno,
  tono,
}: {
  titolo: string
  voci: readonly string[]
  segno: string
  tono: "pronto" | "manca"
}) {
  const colore = tono === "pronto" ? "text-green-600" : "text-gray-400"

  return (
    <div className="p-6 rounded-lg bg-white border border-gray-200">
      <h3 className="font-semibold text-gray-900 mb-4">{titolo}</h3>
      <ul className="space-y-3">
        {voci.map((voce) => (
          <li key={voce} className="flex gap-3 text-gray-700">
            <span className={`${colore} font-bold flex-shrink-0`} aria-hidden="true">
              {segno}
            </span>
            <span>{voce}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
