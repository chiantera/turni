import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Il 14 agosto 2026 «Genera il piano» falliva sempre con
 * `42702: column reference "mese" is ambiguous`.
 *
 * `salva_piano_intervallo` dichiarava una variabile plpgsql `mese` e scriveva
 * su `schedules`, che ha una colonna `mese`. Nella lista `values` non è un
 * problema — le colonne della destinazione non sono in scope — ma la clausola
 * di inferenza `on conflict (...)` nomina per forza colonne della tabella di
 * destinazione, e lì i due candidati coesistono: con il default
 * `plpgsql.variable_conflict = error`, Postgres rifiuta di scegliere.
 *
 * Il difetto è invisibile a `create function`, perché plpgsql compila le
 * istruzioni SQL solo alla prima esecuzione. La migrazione si è applicata
 * pulita e la funzione è rimasta rotta per due settimane.
 *
 * Questo test controlla la definizione **finale** di ogni funzione, cioè
 * l'ultima che le migrazioni in ordine lasciano in piedi: le migrazioni già
 * applicate sono storia e non si riscrivono, quello che conta è lo stato in cui
 * il database finisce.
 */

const CARTELLA = join(process.cwd(), "supabase", "migrations")

/** Corpo di una funzione plpgsql: `create or replace function ... as $$ ... $$;` */
const FUNZIONE =
  /create\s+or\s+replace\s+function\s+(?:public\.)?(\w+)\s*\([\s\S]*?\bas\s+\$\$([\s\S]*?)\$\$\s*;/gi

/** Blocco `declare` fino al `begin` di apertura. */
const DICHIARAZIONI = /\bdeclare\b([\s\S]*?)\bbegin\b/i

/** Lista di colonne di una clausola `on conflict (...)`. */
const ON_CONFLICT = /\bon\s+conflict\s*\(([^)]*)\)/gi

/** L'ultima definizione vince: è quella che resta nel database. */
function definizioniFinali(): Map<string, { corpo: string; migrazione: string }> {
  const finali = new Map<string, { corpo: string; migrazione: string }>()
  const file = readdirSync(CARTELLA)
    .filter((n) => n.endsWith(".sql"))
    .sort()
  for (const nome of file) {
    const sql = readFileSync(join(CARTELLA, nome), "utf8")
    for (const [, funzione, corpo] of sql.matchAll(FUNZIONE)) {
      finali.set(funzione, { corpo, migrazione: nome })
    }
  }
  return finali
}

function variabiliDichiarate(corpo: string): string[] {
  const blocco = corpo.match(DICHIARAZIONI)?.[1]
  if (!blocco) return []
  return blocco
    .split(";")
    .map((riga) => riga.replace(/--.*$/gm, "").trim())
    .map((riga) => riga.match(/^([a-z_][a-z0-9_]*)\s+\S/i)?.[1])
    .filter((nome): nome is string => Boolean(nome))
    .map((nome) => nome.toLowerCase())
}

function colonneInOnConflict(corpo: string): string[] {
  return [...corpo.matchAll(ON_CONFLICT)]
    .flatMap(([, lista]) => lista.split(","))
    .map((colonna) => colonna.trim().toLowerCase())
    .filter((colonna) => /^[a-z_][a-z0-9_]*$/.test(colonna))
}

describe("ambiguità plpgsql nelle migrazioni", () => {
  const finali = definizioniFinali()

  it("trova le funzioni da controllare", () => {
    // Se il parser smettesse di agganciare i corpi, tutto il resto passerebbe
    // a vuoto: un controllo che non può fallire è già morto.
    expect(finali.size).toBeGreaterThanOrEqual(5)
    expect(finali.has("salva_piano_intervallo")).toBe(true)
    expect(variabiliDichiarate(finali.get("salva_piano_intervallo")!.corpo)).toContain("v_mese")
  })

  it.each([...finali.keys()])(
    "%s: nessuna variabile si chiama come una colonna di un on conflict",
    (funzione) => {
      const { corpo, migrazione } = finali.get(funzione)!
      const variabili = new Set(variabiliDichiarate(corpo))
      const collisioni = [...new Set(colonneInOnConflict(corpo))].filter((c) => variabili.has(c))
      expect(
        collisioni,
        `${migrazione}: ${funzione} dichiara ${collisioni.join(", ")}, che è anche una colonna ` +
          `nominata in un on conflict. Postgres solleverà 42702 alla prima esecuzione. ` +
          `Rinomina la variabile con il prefisso v_.`,
      ).toEqual([])
    },
  )
})
