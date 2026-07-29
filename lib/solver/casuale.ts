/**
 * Generatore pseudo-casuale con seme (mulberry32).
 *
 * Il solver DEVE essere deterministico: stesso seme + stessi dati = stesso
 * piano. Senza questo non si può riprodurre un risultato per capirlo, né
 * confrontare due esecuzioni per dire se una modifica ha migliorato le cose.
 * `Math.random()` renderebbe il sistema non verificabile.
 */
export function creaCasuale(seme: number) {
  let a = seme >>> 0
  return function casuale(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Casuale = ReturnType<typeof creaCasuale>

/** Intero in [0, n). */
export function intero(r: Casuale, n: number): number {
  return Math.floor(r() * n)
}

/** Mescola in place (Fisher-Yates). */
export function mescola<T>(r: Casuale, v: T[]): T[] {
  for (let i = v.length - 1; i > 0; i--) {
    const j = intero(r, i + 1)
    ;[v[i], v[j]] = [v[j], v[i]]
  }
  return v
}
