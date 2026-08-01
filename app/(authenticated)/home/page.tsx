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

  // TODO: leggere l'attività recente dal database (serve una tabella di audit).
  // Le date sono fisse: derivarle da Date.now() a ogni render viola le regole
  // di purezza di React e, su dati inventati, "2 giorni fa" resta comunque una
  // finzione che invecchia da sola.
  const recentActivities = [
    {
      id: "1",
      description: "Piano per 1-31 agosto generato",
      timestamp: new Date("2026-07-30T09:00:00Z"),
      type: "plan" as const,
    },
    {
      id: "2",
      description: 'Lavoratore "Marco Rossi" aggiunto',
      timestamp: new Date("2026-07-25T09:00:00Z"),
      type: "worker" as const,
    },
    {
      id: "3",
      description: 'Copertura aggiornata per "Reception"',
      timestamp: new Date("2026-07-18T09:00:00Z"),
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
