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
      nota: "Versioni che coprono il mese in corso",
    },
    {
      label: "Ore questo mese",
      value: hoursThisMonth,
      nota: "Contabilizzate nel piano più recente",
    },
    {
      label: "Lavoratori attivi",
      value: workersActive,
      nota: "Chi può ricevere turni",
    },
  ]

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="scheda p-4">
          <p className="text-sm font-medium text-tenue">{stat.label}</p>
          <p className="mt-1 text-3xl font-semibold">{stat.value}</p>
          <p className="mt-1 text-xs text-tenue">{stat.nota}</p>
        </div>
      ))}
    </div>
  )
}
