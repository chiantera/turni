#!/usr/bin/env bash
# Smoke test contro l'ambiente distribuito.
#
#   ./scripts/verifica-produzione.sh [URL]
#
# Ogni controllo qui dentro corrisponde a un guasto realmente accaduto: sono
# tutti difetti che il typecheck, il lint e i test unitari hanno lasciato
# passare, perché riguardano il sistema in esecuzione e non il sorgente.
# Se aggiungi un controllo, aggiungi anche la riga che dice cosa è successo.
#
# Esce con 1 al primo insieme di fallimenti, ma li esegue tutti: sapere che
# tre cose sono rotte è più utile che scoprirne una alla volta.
set -uo pipefail

BASE="${1:-${BASE_URL:-https://turni-psi.vercel.app}}"
ATTESA=25
fallimenti=0
eseguiti=0

verde()  { printf '  \033[32mok\033[0m   %s\n' "$1"; }
rosso()  { printf '  \033[31mKO\033[0m   %s\n' "$1"; fallimenti=$((fallimenti + 1)); }

# --- stato HTTP, senza seguire i redirect ---------------------------------
# Seguirli nasconderebbe proprio ciò che vogliamo vedere: una rotta pubblica
# che risponde 307 verso il login sembra "200 ok" se curl la insegue.
stato() {
  local percorso="$1" atteso="$2" descrizione="$3"
  eseguiti=$((eseguiti + 1))
  local codice
  codice=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$ATTESA" "$BASE$percorso" || echo "000")
  if [ "$codice" = "$atteso" ]; then
    verde "$percorso -> $codice · $descrizione"
  else
    rosso "$percorso -> $codice (atteso $atteso) · $descrizione"
  fi
}

# --- risorsa statica: esiste, non è vuota, ha il tipo giusto --------------
risorsa() {
  local percorso="$1" tipo_atteso="$2" minimo="$3" descrizione="$4"
  eseguiti=$((eseguiti + 1))
  local risposta codice byte tipo
  risposta=$(curl -s -o /dev/null -w '%{http_code} %{size_download} %{content_type}' \
    --max-time "$ATTESA" "$BASE$percorso" || echo "000 0 -")
  read -r codice byte tipo <<<"$risposta"
  if [ "$codice" != "200" ]; then
    rosso "$percorso -> $codice · $descrizione"
  elif [ "$byte" -lt "$minimo" ]; then
    rosso "$percorso -> solo $byte byte · $descrizione"
  elif [[ "$tipo" != "$tipo_atteso"* ]]; then
    rosso "$percorso -> tipo $tipo (atteso $tipo_atteso) · $descrizione"
  else
    verde "$percorso -> 200, $byte byte, $tipo"
  fi
}

# --- contenuto della pagina ------------------------------------------------
scarica() { curl -s --max-time "$ATTESA" "$BASE$1"; }

contiene() {
  local corpo="$1" testo="$2" descrizione="$3"
  eseguiti=$((eseguiti + 1))
  if grep -qF "$testo" <<<"$corpo"; then
    verde "presente: «$testo» · $descrizione"
  else
    rosso "manca: «$testo» · $descrizione"
  fi
}

assente() {
  local corpo="$1" testo="$2" descrizione="$3"
  eseguiti=$((eseguiti + 1))
  if grep -qF "$testo" <<<"$corpo"; then
    rosso "ricomparso: «$testo» · $descrizione"
  else
    verde "assente: «$testo» · $descrizione"
  fi
}

echo "Verifica di $BASE"
echo

echo "Rotte"
stato / 200                    "la landing è pubblica: era 307 verso /accedi"
stato /privacy 200             "informativa raggiungibile senza account"
stato /accedi 200              "accesso"
stato /home 307                "resta protetta: se diventa 200 la guardia è caduta"
stato /riepilogo 307           "resta protetta"

echo
echo "Risorse statiche"
risorsa /landing-demo.mp4 video/mp4 10000 \
  "era 0 byte, e il middleware rispondeva 307 perché mp4 non era fra le estensioni escluse"
risorsa /landing-demo-fallback.png image/png 5000 "poster del video, era 0 byte"

echo
echo "Endpoint newsletter"
# Indirizzo volutamente non valido: verifica che la rotta sia raggiungibile e
# che validi, senza sporcare la tabella delle iscrizioni con dati di prova.
eseguiti=$((eseguiti + 1))
codice=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/newsletter" \
  -H 'Content-Type: application/json' -d '{"email":"non-valida"}' --max-time "$ATTESA" || echo "000")
if [ "$codice" = "400" ]; then
  verde "POST /api/newsletter con email non valida -> 400 · rotta raggiungibile e validante"
else
  rosso "POST /api/newsletter -> $codice (atteso 400) · 307 significa che il middleware la blocca, 500 che manca la migrazione"
fi

echo
echo "Contenuto della landing"
home=$(scarica /)
contiene "$home" "Turni complessi"  "titolo principale"
contiene "$home" "Beta pubblica"    "stato del prodotto dichiarato"
contiene "$home" "/privacy"         "link all'informativa"
assente  "$home" "Marco R."         "testimonianza inventata, rimossa"
assente  "$home" "Lucia B."         "testimonianza inventata, rimossa"
assente  "$home" "info@turni.app"   "casella senza record MX: qualunque mailto rimbalza"
assente  "$home" "zero scoperte"    "il solver conta i turni scoperti, non li azzera"
assente  "$home" "fino a X"         "segnaposto del prezzo finito in produzione"
assente  "$home" "Nessuna terza parte" "Supabase, Vercel e Mistral trattano i dati"
assente  "$home" "action=signup"      "parametro mai letto da /accedi: era un pulsante verso il nulla"
contiene "$home" "richiedi-accesso"   "le CTA portano al form, non a una registrazione chiusa"

echo
if [ "$fallimenti" -eq 0 ]; then
  printf '\033[32m%s controlli, tutti superati.\033[0m\n' "$eseguiti"
  exit 0
fi
printf '\033[31m%s controlli, %s falliti.\033[0m\n' "$eseguiti" "$fallimenti"
exit 1
