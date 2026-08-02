import { expect, test, type Page } from "@playwright/test"

/**
 * Le pagine che esistono solo dopo il login.
 *
 * Ogni controllo qui corrisponde a un guasto realmente accaduto il 2 agosto
 * 2026, e nessuno dei due era osservabile dall'esterno:
 *
 *  - `/home` rispondeva 500 perché l'activity feed interrogava planning_runs,
 *    una tabella che in produzione non esisteva ancora;
 *  - `/pianificazione` dava 404 perché due pulsanti della dashboard puntavano
 *    al segmento senza il mese.
 *
 * Per un visitatore anonimo entrambe rispondono 307 verso il login, quindi lo
 * smoke test in bash le vedeva sane.
 */

const EMAIL = process.env.SMOKE_EMAIL
const PASSWORD = process.env.SMOKE_PASSWORD

test.skip(
  !EMAIL || !PASSWORD,
  "Servono SMOKE_EMAIL e SMOKE_PASSWORD: account di sola lettura, vedi HANDOFF.md",
)

/** Fallisce se la pagina è un errore di Next invece del contenuto atteso. */
async function nonEUnaPaginaDiErrore(page: Page) {
  await expect(page.locator("body")).not.toContainText("This page could not be found")
  await expect(page.locator("body")).not.toContainText("Application error")
  await expect(page.locator("body")).not.toContainText("500")
}

test.beforeEach(async ({ page }) => {
  await page.goto("/accedi")
  await page.getByLabel(/email/i).fill(EMAIL!)
  await page.getByLabel(/password/i).fill(PASSWORD!)
  await page.getByRole("button", { name: /accedi/i }).click()
  // Dopo il login il middleware porta gli autenticati fuori da /accedi.
  await page.waitForURL((url) => !url.pathname.startsWith("/accedi"), { timeout: 30_000 })
})

test("la dashboard si apre e mostra le sue tre parti", async ({ page }) => {
  await page.goto("/home")
  await nonEUnaPaginaDiErrore(page)

  await expect(page.getByRole("heading", { name: /attività recente/i })).toBeVisible()
  await expect(page.getByText(/piani questo mese/i)).toBeVisible()
  await expect(page.getByText(/lavoratori attivi/i)).toBeVisible()
})

test("le azioni rapide portano a pagine che esistono", async ({ page }) => {
  await page.goto("/home")
  const azione = page.getByRole("link", { name: /pianifica questo mese/i })
  await expect(azione).toBeVisible()

  await azione.click()
  await nonEUnaPaginaDiErrore(page)
  // Il piano vive su /pianificazione/<mese>: il segmento nudo non è una pagina.
  await expect(page).toHaveURL(/\/pianificazione\/\d{4}-\d{2}-\d{2}/)
})

test("/pianificazione senza mese rimanda al mese corrente", async ({ page }) => {
  await page.goto("/pianificazione")
  await nonEUnaPaginaDiErrore(page)
  await expect(page).toHaveURL(/\/pianificazione\/\d{4}-\d{2}-\d{2}/)
})

test("il riepilogo si apre", async ({ page }) => {
  await page.goto("/riepilogo")
  await nonEUnaPaginaDiErrore(page)
  await expect(page.getByRole("heading", { name: /riepilogo/i })).toBeVisible()
})

test("nessun errore JavaScript sulle pagine principali", async ({ page }) => {
  const errori: string[] = []
  page.on("pageerror", (e) => errori.push(e.message))

  for (const percorso of ["/home", "/pianificazione", "/riepilogo"]) {
    await page.goto(percorso)
    await page.waitForLoadState("networkidle")
  }

  expect(errori, `errori JavaScript: ${errori.join(" · ")}`).toHaveLength(0)
})
