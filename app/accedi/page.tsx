import { redirect } from "next/navigation"
import { creaClientServer } from "@/lib/supabase/server"

export const metadata = { title: "Accedi — Turni" }

async function accedi(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) redirect(`/accedi?errore=${encodeURIComponent(error.message)}`)
  redirect("/")
}

async function registrati(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const nome = String(formData.get("nome") ?? "")
  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { nome } },
  })
  if (error) redirect(`/accedi?errore=${encodeURIComponent(error.message)}`)
  redirect("/?benvenuto=1")
}

export default async function PaginaAccedi({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string; registra?: string }>
}) {
  const sp = await searchParams
  const modoRegistrazione = sp.registra === "1"

  return (
    <main className="flex-1 grid place-items-center p-6">
      <div className="scheda w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">Turni</h1>
        <p className="text-sm text-tenue mt-1">
          {modoRegistrazione
            ? "Crea il tuo accesso. Il primo utente registrato diventa amministratore."
            : "Accedi per gestire i turni."}
        </p>

        {sp.errore && (
          <p className="mt-4 rounded-lg bg-allarme-tenue text-allarme text-sm p-3">
            {sp.errore}
          </p>
        )}

        <form action={modoRegistrazione ? registrati : accedi} className="mt-5 space-y-3">
          {modoRegistrazione && (
            <div>
              <label htmlFor="nome" className="text-sm font-medium">
                Nome
              </label>
              <input id="nome" name="nome" className="campo mt-1" required />
            </div>
          )}
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="campo mt-1"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={modoRegistrazione ? "new-password" : "current-password"}
              minLength={8}
              className="campo mt-1"
              required
            />
          </div>
          <button type="submit" className="bottone bottone-primario w-full justify-center">
            {modoRegistrazione ? "Crea accesso" : "Accedi"}
          </button>
        </form>

        <p className="mt-4 text-sm text-tenue">
          {modoRegistrazione ? (
            <a href="/accedi" className="underline">
              Hai già un accesso? Accedi
            </a>
          ) : (
            <a href="/accedi?registra=1" className="underline">
              Primo avvio? Crea il tuo accesso
            </a>
          )}
        </p>
      </div>
    </main>
  )
}
