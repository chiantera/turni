import Link from "next/link"

export const metadata = {
  title: "Trattamento dei dati — Turni",
  description:
    "Quali dati raccoglie Turni, dove vengono conservati e chi altro li tratta.",
}

/**
 * Descrizione fattuale del trattamento, ricavata dal codice: le terze parti
 * elencate sono quelle che il progetto contatta davvero. Non è un'informativa
 * redatta da un legale — va rivista prima di uscire dalla beta.
 */
export default function Privacy() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <Link href="/" className="text-blue-600 hover:underline text-sm">
        ← Torna alla pagina iniziale
      </Link>

      <h1 className="text-3xl md:text-4xl font-semibold mt-6 mb-3">
        Trattamento dei dati
      </h1>
      <p className="text-gray-600 mb-10">
        Aggiornata al 2 agosto 2026. Turni è in beta pubblica: questa pagina
        descrive cosa succede oggi ai dati, in modo verificabile. Non sostituisce
        un&apos;informativa redatta da un legale, che arriverà prima della fine
        della beta.
      </p>

      <Sezione titolo="Cosa raccogliamo">
        <Voce nome="Account">
          Indirizzo email e nome, per farti accedere. La password non è mai
          leggibile da noi.
        </Voce>
        <Voce nome="Dati di pianificazione">
          Nome e cognome dei lavoratori, monte ore, assenze, postazioni e turni
          assegnati. Li inserisci tu, e riguardano altre persone: se usi Turni
          per la tua organizzazione, verso i tuoi dipendenti il titolare del
          trattamento sei tu.
        </Voce>
        <Voce nome="Newsletter">
          Solo l&apos;indirizzo email, la data di iscrizione e se hai confermato.
          Finché non confermi non ricevi nulla.
        </Voce>
      </Sezione>

      <Sezione titolo="Dove stanno">
        <Voce nome="Database — Supabase">
          Anagrafiche, piani e iscrizioni stanno su PostgreSQL gestito da
          Supabase, in un data center dell&apos;Unione Europea. L&apos;accesso è
          regolato riga per riga dal database: un lavoratore vede i propri turni
          pubblicati, non quelli degli altri.
        </Voce>
        <Voce nome="Applicazione — Vercel">
          Il sito e le sue funzioni girano su Vercel, che tratta i dati di
          traffico necessari a servire le pagine.
        </Voce>
      </Sezione>

      <Sezione titolo="Quando i dati escono dall'Unione Europea">
        <p className="text-gray-700 leading-relaxed mb-4">
          Succede in un caso solo, ed è giusto che tu lo sappia prima di
          decidere se usare quella funzione.
        </p>
        <p className="text-gray-700 leading-relaxed mb-4">
          Quando scrivi una richiesta in italiano all&apos;assistente — per
          esempio «Marco è libero la domenica pomeriggio» — il testo{" "}
          <strong>
            e l&apos;elenco dei nomi e cognomi dei lavoratori registrati
          </strong>{" "}
          vengono inviati a un fornitore di modelli linguistici con sede fuori
          dall&apos;Unione Europea. I nomi servono al modello per capire di chi
          stai parlando e restituire un vincolo collegato alla persona giusta.
        </p>
        <p className="text-gray-700 leading-relaxed mb-4">
          Nient&apos;altro esce: né le assenze, né le email, né i piani
          generati. Il solver che costruisce i turni funziona interamente sui
          nostri sistemi e non contatta alcun servizio esterno.
        </p>
        <p className="text-gray-700 leading-relaxed">
          Se questo trasferimento non è compatibile con le tue policy, si può
          usare Turni senza l&apos;assistente: i vincoli si inseriscono
          manualmente e il resto del prodotto funziona identico.
        </p>
      </Sezione>

      <Sezione titolo="Per quanto tempo">
        <p className="text-gray-700 leading-relaxed">
          Finché tieni l&apos;account. Durante la beta non ci sono ancora
          cancellazioni automatiche: se vuoi che rimuoviamo i tuoi dati, aprine
          richiesta su{" "}
          <a
            href="https://github.com/chiantera/turni/issues"
            className="text-blue-600 hover:underline"
          >
            GitHub
          </a>{" "}
          — senza scrivere dati personali nella segnalazione, che è pubblica —
          e li cancelliamo.
        </p>
      </Sezione>

      <Sezione titolo="Cosa non facciamo">
        <ul className="space-y-2 text-gray-700">
          {[
            "Non vendiamo né cediamo dati a terzi per finalità commerciali.",
            "Non usiamo cookie di profilazione né strumenti di analisi comportamentale.",
            "Non usiamo i tuoi dati di pianificazione per addestrare modelli.",
          ].map((voce) => (
            <li key={voce} className="flex gap-3">
              <span className="text-green-600 font-bold" aria-hidden="true">
                ✓
              </span>
              <span>{voce}</span>
            </li>
          ))}
        </ul>
      </Sezione>

      <p className="mt-12 pt-6 border-t text-sm text-gray-500 leading-relaxed">
        Turni è un progetto a sorgente aperto: se vuoi verificare invece di
        fidarti, il codice che fa tutto questo è su{" "}
        <a
          href="https://github.com/chiantera/turni"
          className="text-blue-600 hover:underline"
        >
          GitHub
        </a>
        .
      </p>
    </main>
  )
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-4">{titolo}</h2>
      {children}
    </section>
  )
}

function Voce({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="font-medium text-gray-900">{nome}</h3>
      <p className="text-gray-700 leading-relaxed">{children}</p>
    </div>
  )
}
