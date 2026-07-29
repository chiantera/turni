import { revalidatePath } from "next/cache"

import Navigazione from "@/app/componenti/Navigazione"
import { GIORNI_BREVI } from "@/lib/dati/formato"
import { creaClientServer } from "@/lib/supabase/server"

export const metadata = { title: "Copertura — Turni" }
export const dynamic = "force-dynamic"

/**
 * Salva l'intera griglia in un colpo solo.
 * Modificare una cella alla volta con una chiamata per cella renderebbe la
 * pagina inutilizzabile: una configurazione tipica ha 3 postazioni x 3 turni
 * x 8 colonne = 72 celle.
 */
async function salvaGriglia(formData: FormData) {
  "use server"
  const sb = await creaClientServer()

  const righe: {
    position_id: string
    shift_type_id: string
    giorno_settimana: number | null
    tipo_giorno: "feriale" | "festivo"
    n_richiesti: number
  }[] = []

  for (const [chiave, valore] of formData.entries()) {
    if (!chiave.startsWith("c:")) continue
    // formato: c:<postazione>:<turno>:<giorno|F>
    const [, position_id, shift_type_id, g] = chiave.split(":")
    const n = Number(valore)
    if (!Number.isFinite(n) || n < 0) continue
    righe.push({
      position_id,
      shift_type_id,
      giorno_settimana: g === "F" ? null : Number(g),
      tipo_giorno: g === "F" ? "festivo" : "feriale",
      n_richiesti: n,
    })
  }

  if (righe.length > 0) {
    await sb.from("coverage_rules").upsert(righe, {
      onConflict: "position_id,shift_type_id,giorno_settimana,tipo_giorno",
    })
  }
  revalidatePath("/copertura")
}

export default async function Copertura() {
  const sb = await creaClientServer()
  const [postazioni, turni, regole] = await Promise.all([
    sb.from("positions").select("*").eq("attiva", true).order("ordine"),
    sb.from("shift_types").select("*").eq("attivo", true).order("ordine_rotazione"),
    sb.from("coverage_rules").select("*"),
  ])

  const perChiave = new Map(
    (regole.data ?? []).map((r) => [
      `${r.position_id}:${r.shift_type_id}:${r.tipo_giorno === "festivo" ? "F" : r.giorno_settimana}`,
      r.n_richiesti,
    ]),
  )

  // Fabbisogno settimanale per turno, per mostrare subito se il mix regge.
  const perTurno = new Map<string, { nome: string; totale: number; ore: number }>()
  for (const t of turni.data ?? []) {
    let totale = 0
    for (const p of postazioni.data ?? []) {
      for (let g = 0; g < 7; g++) {
        totale += perChiave.get(`${p.id}:${t.id}:${g}`) ?? 0
      }
    }
    perTurno.set(t.id, {
      nome: t.nome,
      totale,
      ore: (totale * t.durata_min) / 60,
    })
  }
  const oreTotali = [...perTurno.values()].reduce((a, v) => a + v.ore, 0)

  return (
    <>
      <Navigazione />
      <main className="flex-1 mx-auto w-full max-w-6xl p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Copertura</h1>
          <p className="text-sm text-tenue mt-1 max-w-3xl leading-relaxed">
            Quante persone servono per ogni postazione, turno e giorno della
            settimana. La colonna <strong>Fest.</strong> vale per le festività e
            sostituisce quella del giorno.
          </p>
        </div>

        <div className="scheda p-4 text-sm space-y-2">
          <div className="font-medium">Fabbisogno settimanale</div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-tenue">
            {[...perTurno.values()].map((v) => (
              <span key={v.nome}>
                {v.nome}: <strong className="text-testo tabular-nums">{v.totale}</strong> turni ·{" "}
                {v.ore.toString().replace(".", ",")} h
              </span>
            ))}
            <span>
              Totale:{" "}
              <strong className="text-testo tabular-nums">
                {oreTotali.toString().replace(".", ",")} h
              </strong>{" "}
              a settimana ={" "}
              <strong className="text-testo tabular-nums">
                {(oreTotali / 38).toFixed(1).replace(".", ",")}
              </strong>{" "}
              persone a 38h
            </span>
          </div>
          <p className="text-xs text-tenue leading-relaxed">
            Il ciclo canonico produce per persona 2 mattini, 2 pomeriggi e 1 notte a
            settimana. Se il rapporto fra le colonne qui sopra si discosta molto da
            2:2:1, il monte ore può tornare mentre alcuni turni restano comunque
            difficili da coprire — tipicamente le notti.
          </p>
        </div>

        {(postazioni.data ?? []).length === 0 || (turni.data ?? []).length === 0 ? (
          <p className="text-sm text-tenue">
            Servono almeno una postazione e un tipo di turno.
          </p>
        ) : (
          <form action={salvaGriglia} className="space-y-4">
            {(postazioni.data ?? []).map((p) => (
              <div key={p.id} className="scheda overflow-x-auto">
                <div className="px-4 py-3 border-b border-bordo font-medium flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: p.colore }}
                  />
                  {p.nome}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-tenue">
                      <th className="text-left font-normal px-4 py-2">Turno</th>
                      {GIORNI_BREVI.map((g, i) => (
                        <th
                          key={i}
                          className={`font-normal px-2 py-2 ${
                            i === 0 || i === 6 ? "text-avviso" : ""
                          }`}
                        >
                          {g}
                        </th>
                      ))}
                      <th className="font-normal px-2 py-2 text-avviso">Fest.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(turni.data ?? []).map((t) => (
                      <tr
                        id={`copertura-${p.id}-${t.id}`}
                        key={t.id}
                        className="scroll-mt-4 border-t border-bordo target:bg-accento-tenue target:outline target:outline-2 target:outline-accento"
                      >
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            className="inline-block w-5 h-5 leading-5 rounded text-center text-white text-xs font-medium mr-2"
                            style={{ backgroundColor: t.colore }}
                          >
                            {t.codice}
                          </span>
                          {t.nome}
                        </td>
                        {[0, 1, 2, 3, 4, 5, 6].map((g) => (
                          <td key={g} className="px-1 py-1 text-center">
                            <input
                              type="number"
                              min={0}
                              max={99}
                              name={`c:${p.id}:${t.id}:${g}`}
                              defaultValue={perChiave.get(`${p.id}:${t.id}:${g}`) ?? 0}
                              className="campo w-14 text-center tabular-nums"
                            />
                          </td>
                        ))}
                        <td className="px-1 py-1 text-center bg-avviso-tenue/40">
                          <input
                            type="number"
                            min={0}
                            max={99}
                            name={`c:${p.id}:${t.id}:F`}
                            defaultValue={perChiave.get(`${p.id}:${t.id}:F`) ?? 0}
                            className="campo w-14 text-center tabular-nums"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <button type="submit" className="bottone bottone-primario">
              Salva la griglia
            </button>
          </form>
        )}
      </main>
    </>
  )
}
