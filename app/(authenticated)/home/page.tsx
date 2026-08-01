import { creaClientServer } from "@/lib/supabase/server"
import WelcomeHeader from "./componenti/WelcomeHeader"
import StatsRow from "./componenti/StatsRow"
import QuickActions from "./componenti/QuickActions"
import ActivityFeed from "./componenti/ActivityFeed"

export default async function DashboardPage() {
  const supabase = await creaClientServer()

  const { data: { session } } = await supabase.auth.getSession()
  const userName = session?.user?.user_metadata?.name || "Utente"

  // TODO: Fetch stats from database
  const plansThisMonth = 3
  const hoursThisMonth = 240
  const workersActive = 15

  // TODO: Fetch recent activity from database
  const recentActivities = [
    {
      id: "1",
      description: "Piano per 1-31 agosto generato",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      type: "plan" as const,
    },
    {
      id: "2",
      description: 'Lavoratore "Marco Rossi" aggiunto',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      type: "worker" as const,
    },
    {
      id: "3",
      description: 'Copertura aggiornata per "Reception"',
      timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      type: "coverage" as const,
    },
  ]

  return (
    <div className="p-8">
      <WelcomeHeader userName={userName} />
      <StatsRow
        plansThisMonth={plansThisMonth}
        hoursThisMonth={hoursThisMonth}
        workersActive={workersActive}
      />
      <QuickActions />
      <ActivityFeed activities={recentActivities} />
    </div>
  )
}
