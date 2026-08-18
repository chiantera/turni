import { attivitaRecenti, type TipoAttivita } from "@/lib/dati/attivita"
import { meseCorrente, spostaMese } from "@/lib/dati/formato"
import { leggiStatoConfigurazione, primiPassi } from "@/lib/dati/primi-passi"
import { statisticheDashboard } from "@/lib/dati/statistiche"
import { creaClientServer, utenteCorrente } from "@/lib/supabase/server"
import WelcomeHeader from "./componenti/WelcomeHeader"
import ComeFunziona from "./componenti/ComeFunziona"
import PrimiPassi from "./componenti/PrimiPassi"
import StatsRow from "./componenti/StatsRow"
import QuickActions from "./componenti/QuickActions"
import ActivityFeed from "./componenti/ActivityFeed"

// Le statistiche dipendono dai cookie di sessione: niente cache fra utenti.
export const dynamic = "force-dynamic"

// I componenti della dashboard parlano inglese, il livello dati italiano:
// la traduzione sta qui, sul confine, invece che sparsa nei due.
const TIPO_ATTIVITA: Record<TipoAttivita, "plan" | "worker" | "position"> = {
  piano: "plan",
  lavoratore: "worker",
  postazione: "position",
}

export default async function DashboardPage() {
  const supabase = await creaClientServer()

  const corrente = await utenteCorrente()
  const userName = corrente?.profilo?.nome || "Utente"

  const mese = meseCorrente()
  const [stats, attivita, configurazione] = await Promise.all([
    statisticheDashboard(supabase),
    attivitaRecenti(supabase),
    leggiStatoConfigurazione(supabase),
  ])

  const recentActivities = attivita.map((voce) => ({
    id: voce.id,
    description: voce.descrizione,
    timestamp: new Date(voce.quando),
    type: TIPO_ATTIVITA[voce.tipo],
  }))

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
      <WelcomeHeader userName={userName} />
      <ComeFunziona />
      <PrimiPassi passi={primiPassi(configurazione)} />
      <StatsRow
        plansThisMonth={stats.pianiMese}
        hoursThisMonth={stats.oreMese}
        workersActive={stats.lavoratoriAttivi}
      />
      <QuickActions
        currentMonthHref={`/pianificazione/${mese}`}
        nextMonthHref={`/pianificazione/${spostaMese(mese, 1)}`}
      />
      <ActivityFeed activities={recentActivities} />
    </main>
  )
}
