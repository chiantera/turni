export const LANDING_COPY = {
  hero: {
    headline: "Turni complessi?",
    headlineSecond: "Risolvi in minuti, non ore.",
    subheader:
      "Pianificazione automatica con assistente in italiano e solver deterministico. Copertura, monte ore e riposi verificati prima che il piano ti venga mostrato. Export in Excel e iCalendar.",
    ctaPrimary: "Inizia gratis",
    ctaSecondary: "Guarda la demo",
  },
  video: {
    headline: "Genera un piano in 3 step",
    subheader:
      "Dall'idea al piano in minuti. Niente fogli Excel, niente errori.",
  },
  problem: {
    headline: "Pianificazione manuale = caos",
    bullets: [
      "Errori e scoperte dell'ultimo minuto",
      "Conflitti tra lavoratori che non accettano il turno",
      "Modifiche continue, niente traccia",
      "Ore spese in Excel + sincronizzazione manuale",
    ],
  },
  solution: {
    headline: "Turni risolve tutto",
    bullets: [
      "L'assistente estrae i vincoli dall'italiano scritto come si parla",
      "Il solver verifica copertura, monte ore e riposi minimi",
      "Modifiche interattive con validazione istantanea",
      "Export automatico in Excel e iCalendar",
    ],
  },
  features: {
    headline: "Tre cose che cambiano tutto",
    items: [
      {
        icon: "🤖",
        title: "Assistente in italiano",
        description:
          "Scrivi «Marco è libero la domenica pomeriggio». L'assistente propone il vincolo, tu confermi: nessun modulo, nessun gergo tecnico.",
      },
      {
        icon: "⚙️",
        title: "Solver deterministico",
        description:
          "Stessi dati, stesso piano: nessuna sorpresa fra due esecuzioni. Se l'organico non basta te lo dice prima, invece di consegnarti una griglia con dei buchi.",
      },
      {
        icon: "📅",
        title: "Intervalli flessibili",
        description: "Da 1 giorno a 366 giorni. Pianifica qualsiasi arco temporale senza limiti.",
      },
    ],
  },
  // Niente testimonianze finché non ce ne saranno di vere: inventare
  // apprezzamenti di clienti inesistenti è la cosa più facile da fare e la più
  // difficile da recuperare. Al loro posto lo stato onesto del prodotto.
  beta: {
    etichetta: "Beta pubblica",
    headline: "Turni è in beta, e si vede",
    testo:
      "Nessuna testimonianza in questa pagina: non abbiamo ancora clienti da citare. " +
      "Quello che c'è funziona ed è testato, ma stiamo cercando chi lo usi sul serio " +
      "e ci dica cosa manca.",
    pronti: {
      titolo: "Cosa è pronto",
      voci: [
        "Solver deterministico su intervalli da 1 a 366 giorni",
        "Estrazione dei vincoli dall'italiano, con conferma prima di applicarli",
        "Griglia interattiva con validazione a ogni modifica",
        "Export in Excel e iCalendar",
      ],
    },
    mancano: {
      titolo: "Cosa manca ancora",
      voci: [
        "Nessun piano a pagamento: durante la beta si usa gratis",
        "Il video qui sopra è un'illustrazione, non una registrazione del prodotto",
        "Notifiche e app mobile non esistono",
        "Le richieste in linguaggio naturale passano da un fornitore AI esterno (Mistral, in UE)",
      ],
    },
  },
  cta: {
    headline: "Pronto a risolvere i turni?",
    subheader: "Accesso gratuito, niente carte. Setup in 10 minuti.",
    button: "Inizia gratis",
    newsletter: "Ricevi tips sulla pianificazione",
    newsletterPlaceholder: "nome@azienda.it",
    newsletterBottone: "Iscriviti",
    newsletterInvio: "Invio…",
    newsletterOk: "Fatto. Ti scriviamo per confermare l'iscrizione.",
    newsletterErrore: "Non siamo riusciti a registrare l'iscrizione. Riprova più tardi.",
    newsletterConsenso:
      "Registriamo il tuo indirizzo e non ti scriviamo nulla finché non avrai " +
      "confermato l'iscrizione: il messaggio di conferma conterrà il link per " +
      "cancellarti. Solo contenuti sulla pianificazione dei turni, mai comunicazioni " +
      "commerciali di terzi.",
  },
  faq: [
    {
      q: "Cos'è un 'solver deterministico'?",
      a: "Un algoritmo che a parità di dati produce sempre lo stesso piano, e che verifica copertura, monte ore e riposi minimi prima di mostrartelo. Se i vincoli non sono soddisfacibili — per esempio perché mancano persone — te lo dice e spiega dove, invece di consegnare una griglia con dei buchi.",
    },
    {
      q: "Come funziona l'AI?",
      a: "Legge le richieste in italiano naturale (es. 'Marco domenica pomeriggio libera') e le converte in vincoli strutturati che l'utente può confermare. Non genera direttamente i turni — solo valida i vincoli.",
    },
    {
      q: "Posso modificare manualmente i turni?",
      a: "Sì, griglia completamente interattiva. Ogni modifica è validata in tempo reale. Le celle modificate manualmente restano 'bloccate' nelle rigenerazioni future.",
    },
    {
      q: "Quanto costa?",
      a: "Durante la beta niente: si usa gratis e senza carta di credito. I prezzi non sono ancora decisi, e non lo saranno finché non avremo capito a chi serve davvero. Chi partecipa alla beta lo saprà in anticipo.",
    },
    {
      q: "Dove finiscono i miei dati?",
      a: "Anagrafiche, turni e piani stanno su PostgreSQL gestito da Supabase in un data center dell'Unione Europea; l'applicazione gira su Vercel. Quando si usa l'assistente in italiano, il testo della richiesta e l'elenco dei nomi dei lavoratori vengono inviati a Mistral AI, società francese, perché il modello possa capire di chi si sta parlando: è un fornitore esterno, ma resta nell'Unione Europea. Il dettaglio completo è nella pagina Trattamento dei dati.",
    },
  ],
  footer: {
    // Ogni indirizzo qui sotto è stato verificato. Il dominio turni.app non ha
    // record MX: qualunque mailto: verso info@turni.app rimbalzerebbe, quindi
    // durante la beta il canale di contatto è GitHub.
    links: [
      { label: "Documentazione", href: "https://github.com/chiantera/turni#readme" },
      { label: "GitHub", href: "https://github.com/chiantera/turni" },
      { label: "Trattamento dei dati", href: "/privacy" },
    ],
    social: [
      { label: "Segnala un problema", href: "https://github.com/chiantera/turni/issues" },
    ],
    copyright: "© 2026 Turni. Beta pubblica.",
  },
}
