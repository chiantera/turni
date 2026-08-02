import { defineConfig, devices } from "@playwright/test"

/**
 * Test end-to-end contro un ambiente già in esecuzione.
 *
 * Non avvia un server: punta a quello che gli dici, per default la produzione.
 * Lo smoke test in bash copre la superficie pubblica; questi coprono ciò che
 * sta dietro l'autenticazione, che è il punto cieco dove si sono nascosti
 * entrambi i difetti del 2 agosto 2026 — /home che rispondeva 500 e
 * /pianificazione che dava 404. Dall'esterno erano invisibili: senza sessione
 * il middleware risponde 307 prima che il guasto conti qualcosa.
 */
export default defineConfig({
  testDir: "./e2e",
  // Un fallimento intermittente in un test di produzione è quasi sempre la
  // rete, non l'applicazione: un solo tentativo in più, per non nasconderla.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "https://turni-psi.vercel.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
