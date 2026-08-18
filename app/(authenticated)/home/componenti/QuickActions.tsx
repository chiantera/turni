import Link from "next/link"

interface QuickActionsProps {
  /** Percorsi calcolati dal server: il mese non si deduce durante il render. */
  currentMonthHref: string
  nextMonthHref: string
}

export default function QuickActions({
  currentMonthHref,
  nextMonthHref,
}: QuickActionsProps) {
  const actions = [
    { label: "Pianifica questo mese", href: currentMonthHref },
    { label: "Pianifica il mese prossimo", href: nextMonthHref },
    { label: "Riepilogo ore", href: "/riepilogo" },
    { label: "Gestisci lavoratori", href: "/lavoratori" },
  ]

  return (
    <div className="scheda mb-8 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Azioni rapide</h2>
      <p className="mt-1 text-sm text-tenue">
        Le stesse pagine sono sempre raggiungibili dal menu in alto.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-lg border border-bordo p-3 text-sm font-medium hover:border-accento hover:bg-accento-tenue"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
