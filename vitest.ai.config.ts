import { defineConfig } from "vitest/config"
import { caricaEnvLocale } from "./test/carica-env"

caricaEnvLocale()

// Nota: niente mergeConfig con la configurazione base — concatena gli array
// invece di sostituirli, e `include` finirebbe per contenere anche i test
// normali, eseguendo l'intera suite a ogni prova sull'AI.

/**
 * Test d'integrazione con l'AI: chiamate reali al provider, quindi lenti,
 * a pagamento e dipendenti dalla rete.
 *
 * Tenuti fuori da `npm test` di proposito. Se fallissero nella suite normale,
 * un problema esterno (credito esaurito, provider offline) tingerebbe di rosso
 * l'intera build e mascherebbe le regressioni vere del codice.
 *
 *   npm run test:ai                          # sul provider configurato
 *   $env:AI_MODEL='glm-4.5-flash'; npm run test:ai
 *   $env:AI_PROVIDER='deepseek'; npm run test:ai
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.itest.ts"],
    environment: "node",
    testTimeout: 120_000,
    alias: { "server-only": new URL("./test/vuoto.ts", import.meta.url).pathname },
  },
})
