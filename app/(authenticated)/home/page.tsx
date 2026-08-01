import { statisticheDashboard } from "@/lib/dati/statistiche"
import { creaClientServer, utenteCorrente } from "@/lib/supabase/server"
import WelcomeHeader from "./componenti/WelcomeHeader"
import StatsRow from "./componenti/StatsRow"
import QuickActions from "./componenti/QuickActions"
import ActivityFeed from "./componenti/ActivityFeed"

// Le statistiche dipendono dai cookie di sessione: niente cache fra utenti.
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = await creaClientServer()

  const corrente = await utenteCorrente()
  const userName = corrente?.profilo?.nome || "Utente"

  const stats = await statisticheDashboard(supabase)

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
        plansThisMonth={stats.pianiMese}
        hoursThisMonth={stats.oreMese}
        workersActive={stats.lavoratoriAttivi}
      />
      <QuickActions />
      <ActivityFeed activities={recentActivities} />
    </div>
  )
}
