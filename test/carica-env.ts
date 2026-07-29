import { readFileSync } from "node:fs"

/**
 * Carica .env.local in process.env per i test.
 *
 * Le variabili già presenti nell'ambiente vincono: così si può puntare a un
 * altro modello senza toccare il file, es.
 *   $env:AI_MODEL='glm-4.5-flash'; npm run test:ai
 */
export function caricaEnvLocale(percorso = ".env.local") {
  try {
    for (const riga of readFileSync(percorso, "utf8").split("\n")) {
      const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  } catch {
    // Nessun .env.local: normale in CI.
  }
}
