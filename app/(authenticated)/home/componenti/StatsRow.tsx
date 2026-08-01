interface StatsRowProps {
  plansThisMonth: number
  hoursThisMonth: number
  workersActive: number
}

export default function StatsRow({
  plansThisMonth,
  hoursThisMonth,
  workersActive,
}: StatsRowProps) {
  const stats = [
    {
      label: "Piani questo mese",
      value: plansThisMonth,
      icon: "📋",
    },
    {
      label: "Ore questo mese",
      value: hoursThisMonth,
      icon: "⏱️",
    },
    {
      label: "Lavoratori attivi",
      value: workersActive,
      icon: "👥",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm"
        >
          <div className="text-3xl mb-2">{stat.icon}</div>
          <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}
