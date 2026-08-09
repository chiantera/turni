/**
 * Traduzione degli errori delle RPC del piano in risposte HTTP.
 *
 * Le funzioni `salva_modifiche_intervallo` e `applica_riduzione_ore` segnalano
 * i propri rifiuti con `raise exception '<NOME_SIMBOLICO>'`. Postgres assegna a
 * quelle eccezioni il codice **P0001**, uguale per tutte: il discriminante è
 * quindi il messaggio, non il codice.
 *
 * Fino al 9 agosto 2026 usavano invece `errcode = '40001'`, cioè
 * `serialization_failure` — che in Postgres non è un'etichetta ma un
 * protocollo: significa «riprova, la prossima volta forse riesce». Applicato a
 * una regola permanente ha prodotto 135 milioni di transazioni abortite in
 * cinque giorni, a 357 al secondo, perché chi leggeva quel codice riprovava
 * all'infinito.
 *
 * Il codice HTTP che restituiamo resta nostro: 409 dove il conflitto è reale e
 * ricaricando si risolve, 400 dove la richiesta è semplicemente sbagliata.
 */

export interface ErrorePostgres {
  code?: string
  message?: string
}

export interface RispostaErrore {
  stato: number
  messaggio: string
}

/**
 * Per nome simbolico. Il messaggio è quello che legge il pianificatore, quindi
 * deve dire cosa fare, non cosa è andato storto.
 */
const PER_NOME: Record<string, RispostaErrore> = {
  PIANO_OBSOLETO: {
    stato: 409,
    messaggio:
      "Il piano è cambiato da quando l'hai aperto. Ricarica la pagina prima di riprovare.",
  },
  PRECONDIZIONE_NON_SODDISFATTA: {
    stato: 409,
    messaggio:
      "Una delle celle è cambiata da quando hai visto il preview. Ricalcolalo e riprova.",
  },
  ASSEGNAZIONE_BLOCCATA: {
    stato: 409,
    messaggio: "Una delle celle è bloccata: sbloccala prima di modificarla.",
  },
  CELLA_FUORI_INTERVALLO: {
    stato: 400,
    messaggio: "Una delle modifiche cade fuori dall'intervallo del piano.",
  },
  NON_AUTORIZZATO: {
    stato: 403,
    messaggio: "Non hai i permessi per modificare il piano.",
  },
  PIANO_NON_TROVATO: {
    stato: 404,
    messaggio: "Il piano non esiste più.",
  },
  MODIFICHE_NON_VALIDE: {
    stato: 400,
    messaggio: "La richiesta di modifica non è valida.",
  },
  PRECONDIZIONI_NON_VALIDE: {
    stato: 400,
    messaggio: "La richiesta di applicazione non è valida.",
  },
}

/**
 * Per SQLSTATE, quando il messaggio non è uno dei nostri: copre gli errori che
 * Postgres solleva di sua iniziativa, ad esempio una policy RLS che nega.
 */
const PER_CODICE: Record<string, number> = {
  "42501": 403,
  P0002: 404,
  "22023": 400,
}

export function interpretaErrorePiano(
  errore: ErrorePostgres,
  ripiego: string,
): RispostaErrore {
  const perNome = errore.message ? PER_NOME[errore.message.trim()] : undefined
  if (perNome) return perNome

  return {
    stato: (errore.code ? PER_CODICE[errore.code] : undefined) ?? 400,
    messaggio: ripiego,
  }
}
