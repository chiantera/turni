import type { ReactNode } from "react"
import { creaClientServer } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const supabase = await creaClientServer()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect("/")
  }

  return (
    <html lang="it">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
