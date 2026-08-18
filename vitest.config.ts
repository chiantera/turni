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
    alias: {
      "server-only": new URL("./test/vuoto.ts", import.meta.url).pathname,
      // Vitest non legge i `paths` di tsconfig: un `import ... from "@/lib/..."`
      // che non sia solo di tipo compila e poi esplode a runtime nei test, e
      // typecheck non lo vede. Dentro `lib/` si usano percorsi relativi; questo
      // e' la rete perche' la prossima volta non sia una sorpresa.
      "@": new URL("./", import.meta.url).pathname.replace(/\/$/, ""),
    },
  },
})
