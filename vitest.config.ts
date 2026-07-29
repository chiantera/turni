import { defineConfig } from "vitest/config"
import { caricaEnvLocale } from "./test/carica-env"

caricaEnvLocale()

export default defineConfig({
  test: {
    // I test d'integrazione con l'AI (*.itest.ts) stanno fuori di proposito:
    // vedi vitest.ai.config.ts.
    include: ["lib/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    // `server-only` esplode fuori da Next: nei test lo sostituisco con un
    // modulo vuoto, così posso testare il codice server senza avviare il server.
    alias: { "server-only": new URL("./test/vuoto.ts", import.meta.url).pathname },
  },
})
