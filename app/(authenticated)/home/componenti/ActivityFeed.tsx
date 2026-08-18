interface Activity {
  id: string
  description: string
  timestamp: Date
  type: "plan" | "worker" | "position"
}

interface ActivityFeedProps {
  activities: Activity[]
}

const ETICHETTA_TIPO: Record<Activity["type"], string> = {
  plan: "Piano",
  worker: "Lavoratore",
  position: "Postazione",
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  const formatDate = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Oggi"
    if (diffDays === 1) return "Ieri"
    if (diffDays < 7) return `${diffDays} giorni fa`
    return date.toLocaleDateString("it-IT")
  }

  return (
    <div className="scheda p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Attività recente</h2>
      <p className="mt-1 text-sm text-tenue">
        Non esiste un registro delle modifiche: qui si vede quando qualcosa è
        stato creato o aggiornato, non quante volte né da chi.
      </p>
      <div className="mt-4 space-y-3">
        {activities.length > 0 ? (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex flex-wrap items-baseline gap-x-3 border-b border-bordo pb-3 last:border-b-0 last:pb-0"
            >
              <span className="rounded-full bg-accento-tenue px-2 py-0.5 text-xs text-accento">
                {ETICHETTA_TIPO[activity.type]}
              </span>
              <p className="flex-1 text-sm">{activity.description}</p>
              <p className="text-sm text-tenue">
                {formatDate(activity.timestamp)}
              </p>
            </div>
          ))
        ) : (
          <p className="py-4 text-sm text-tenue">
            Nessuna attività recente. Comparirà qui appena aggiungi un
            lavoratore, una postazione o generi un piano.
          </p>
        )}
      </div>
    </div>
  )
}
