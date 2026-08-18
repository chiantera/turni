import Link from "next/link"

/**
 * Le tre frasi che spiegano cosa fa Turni.
 *
 * Ogni affermazione qui dentro e' verificata contro il codice, non contro
 * l'intenzione: la conferma esplicita esiste (`app/vincoli/Assistente.tsx`,
 * pulsante «Conferma N vincoli»), il solver e' deterministico e le violazioni
 * restano in tabella invece di sparire. La pagina pubblica ha gia' pagato una
 * volta il prezzo di una promessa che il codice non manteneva.
 */
const PUNTI = [
  {
    titolo: "Descrivi, non compilare",
    testo: (
      <>
        «Rossi non fa notti a settembre», scritto in italiano.{" "}
        <Link href="/vincoli" className="underline">
          L&apos;assistente
        </Link>{" "}
        lo traduce in un vincolo e te lo fa confermare prima di applicarlo. Sta
        in Vincoli, non nella pagina del piano.
      </>
    ),
  },
  {
    titolo: "Decide il solver, non l'AI",
    testo: (
      <>
        Il piano lo calcola un algoritmo deterministico: stessi dati, stesso
        piano. Se una copertura è impossibile te lo dice e spiega quale vincolo
        la blocca, invece di inventare una soluzione.
      </>
    ),
  },
  {
    titolo: "L'ultima parola è tua",
    testo: (
      <>
        Ogni cella del piano si corregge a mano. Le violazioni che introduci
        restano segnalate, non cancellate: il piano resta tuo e sai cosa stai
        accettando.
      </>
    ),
  },
]

export default function ComeFunziona() {
  return (
    <section aria-labelledby="come-funziona" className="mb-8">
      <h2 id="come-funziona" className="sr-only">
        Come funziona Turni
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {PUNTI.map((punto) => (
          <div key={punto.titolo} className="scheda p-4">
            <h3 className="text-sm font-semibold">{punto.titolo}</h3>
            <p className="mt-1 text-sm text-tenue">{punto.testo}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
