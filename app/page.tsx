import { redirect } from "next/navigation"
import { creaClientServer } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function RootPage() {
  const supabase = await creaClientServer()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect("/home")
  } else {
    redirect("/")
  }
}
