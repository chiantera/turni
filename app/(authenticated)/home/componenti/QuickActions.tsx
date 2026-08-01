import Link from "next/link"

export default function QuickActions() {
  const actions = [
    { label: "Genera nuovo piano", href: "/pianificazione", icon: "✨" },
    { label: "Visualizza questo mese", href: "/pianificazione", icon: "📅" },
    { label: "Gestisci lavoratori", href: "/lavoratori", icon: "👥" },
    { label: "Gestisci postazioni", href: "/postazioni", icon: "🏢" },
  ]

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Azioni rapide</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {actions.map((action, idx) => (
          <Link
            key={idx}
            href={action.href}
            className="p-4 text-center rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors"
          >
            <div className="text-3xl mb-2">{action.icon}</div>
            <p className="font-medium text-gray-900 text-sm">{action.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
