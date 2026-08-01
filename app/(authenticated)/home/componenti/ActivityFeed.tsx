interface Activity {
  id: string
  description: string
  timestamp: Date
  type: "plan" | "worker" | "coverage"
}

interface ActivityFeedProps {
  activities: Activity[]
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
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Attività recente
      </h2>
      <div className="space-y-4">
        {activities.length > 0 ? (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex gap-4 pb-4 border-b last:border-b-0"
            >
              <div className="text-2xl flex-shrink-0">
                {activity.type === "plan"
                  ? "📋"
                  : activity.type === "worker"
                    ? "👤"
                    : "📍"}
              </div>
              <div className="flex-1">
                <p className="text-gray-900 font-medium">{activity.description}</p>
                <p className="text-gray-500 text-sm">{formatDate(activity.timestamp)}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center py-8">Nessuna attività recente</p>
        )}
      </div>
    </div>
  )
}
