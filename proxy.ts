import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Rinnova la sessione a ogni richiesta e protegge le rotte applicative.
 * Senza questo il token scade durante la navigazione e l'utente si ritrova
 * disconnesso a metà di una modifica ai turni.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (daImpostare) => {
          for (const { name, value } of daImpostare) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of daImpostare) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const percorso = request.nextUrl.pathname
  // La landing vive sulla root ed è il biglietto da visita del prodotto:
  // deve rispondere a chi un account non ce l'ha ancora.
  const pubblica =
    percorso === "/" || percorso.startsWith("/accedi") || percorso.startsWith("/auth")

  if (!user && !pubblica) {
    const url = request.nextUrl.clone()
    url.pathname = "/accedi"
    url.searchParams.set("da", percorso)
    return NextResponse.redirect(url)
  }

  // Chi ha già una sessione non ha niente da leggere sulla pagina di vendita
  // né sul form di accesso: la sua home è la dashboard.
  if (user && (percorso === "/" || percorso === "/accedi")) {
    const url = request.nextUrl.clone()
    url.pathname = "/home"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)"],
}
