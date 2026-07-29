import { redirect } from "next/navigation"
import { destinazioneDopoAccesso } from "@/lib/dati/navigazione"
import { creaClientServer } from "@/lib/supabase/server"

export const metadata = { title: "Accedi — Turni" }

async function accedi(formData: FormData) {
  "use server"
  const sb = await creaClientServer()
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const da = String(formData.get("da") ?? "") || undefined
  const dal = String(formData.get("dal") ?? "") || undefined
  const al = String(formData.get("al") ?? "") || undefined
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) {
    const query = new URLSearchParams({ errore: error.message })
    if (da) query.set("da", da)
    if (dal) query.set("dal", dal)
    if (al) query.set("al", al)
    redirect(`/accedi?${query}`)
  }
  redirect(destinazioneDopoAccesso({ da, dal, al }))
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
  searchParams: Promise<{
    errore?: string
    registra?: string
    da?: string
    dal?: string
    al?: string
  }>
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
          {!modoRegistrazione && (
            <>
              <input type="hidden" name="da" value={sp.da ?? ""} />
              <input type="hidden" name="dal" value={sp.dal ?? ""} />
              <input type="hidden" name="al" value={sp.al ?? ""} />
            </>
          )}
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
