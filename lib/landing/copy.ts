export const LANDING_COPY = {
  hero: {
    headline: "Turni complessi?",
    headlineSecond: "Risolvi in minuti, non ore.",
    subheader:
      "Pianificazione automatica con AI + solver deterministico. Copertura garantita, zero scoperte, export in Excel e iCal.",
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
      "AI estrae i vincoli dal linguaggio naturale italiano",
      "Solver deterministico garantisce copertura legale",
      "Modifiche interattive con validazione istantanea",
      "Export automatico in Excel e iCalendar",
    ],
  },
  features: {
    headline: "Tre cose che cambiano tutto",
    items: [
      {
        icon: "🤖",
        title: "AI in italiano",
        description:
          "Estrai vincoli in 10 secondi. AI capisce richieste naturali senza jargon tecnico.",
      },
      {
        icon: "⚙️",
        title: "Solver deterministico",
        description:
          "Garantisce copertura 100%, zero scoperte. Algoritmo verificato, non euristico.",
      },
      {
        icon: "📅",
        title: "Intervalli flessibili",
        description: "Da 1 giorno a 366 giorni. Pianifica qualsiasi arco temporale senza limiti.",
      },
    ],
  },
  testimonials: [
    {
      stars: 5,
      quote:
        "Prima passavo 8 ore a settimana su Excel. Ora il piano è pronto in 20 minuti. E senza errori.",
      author: "Marco R.",
      role: "HR Manager, PMI Veneto",
    },
    {
      stars: 5,
      quote:
        "L'AI capisce subito cosa significa 'Marco domenica pomeriggio libera'. Non devo più scrivere per ore.",
      author: "Lucia B.",
      role: "Coordinatrice Turni, Lomellina",
    },
  ],
  cta: {
    headline: "Pronto a risolvere i turni?",
    subheader: "Accesso gratuito, niente carte. Setup in 10 minuti.",
    button: "Inizia gratis",
    newsletter: "Ricevi tips sulla pianificazione",
  },
  faq: [
    {
      q: "Cos'è un 'solver deterministico'?",
      a: "Un algoritmo che costruisce la griglia garantendo copertura, monte ore, e riposi legali. A differenza di euristiche, il deterministic solver verifica che il risultato sia valido prima di presentarlo.",
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
      a: "Accesso gratuito per provare. Piano futuro: freemium per PMI fino a X lavoratori, pro tier per aziende più grandi.",
    },
    {
      q: "I miei dati sono privati?",
      a: "Sì, hosted on Supabase PostgreSQL in Italia. Nessuna terza parte. Pieno controllo dei vostri dati.",
    },
  ],
  footer: {
    links: [
      { label: "Documentazione", href: "/docs" },
      { label: "GitHub", href: "https://github.com/chiantera/turni" },
      { label: "Contatti", href: "mailto:info@turni.app" },
    ],
    social: [
      { label: "LinkedIn", href: "https://linkedin.com" },
      { label: "Email", href: "mailto:info@turni.app" },
    ],
    copyright: "© 2026 Turni. Tutti i diritti riservati.",
  },
}
