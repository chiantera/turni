#!/usr/bin/env bash
# Rigenera il video demo della landing page a partire da fotogrammi.html.
#
#   ./scripts/demo-landing/genera.sh
#
# Ogni fotogramma è uno stato statico calcolato da ?f=N: nessuna animazione a
# tempo, quindi lo screenshot cattura sempre esattamente lo stato voluto e due
# esecuzioni producono lo stesso video.
#
# Serve un Chromium headless. Se manca:  npx playwright install chromium
set -euo pipefail

RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SORGENTE="$RADICE/scripts/demo-landing/fotogrammi.html"
LAVORO="$(mktemp -d)"
trap 'rm -rf "$LAVORO"' EXIT

N_FOTOGRAMMI=60
FPS_SORGENTE=4      # 60 fotogrammi a 4/s = 15 secondi
POSTER=52           # il piano completo: è il fotogramma che invita a guardare

trova_chromium() {
  for c in chromium chromium-browser google-chrome; do
    command -v "$c" >/dev/null && { command -v "$c"; return; }
  done
  find "$HOME/.cache/ms-playwright" -maxdepth 3 -type f \
    \( -name chrome-headless-shell -o -name chrome \) 2>/dev/null | head -1
}

CHROMIUM="$(trova_chromium)"
[ -n "$CHROMIUM" ] || { echo "Chromium non trovato: npx playwright install chromium" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg non trovato" >&2; exit 1; }

echo "Chromium: $CHROMIUM"
mkdir -p "$LAVORO/frames"
for n in $(seq 0 $((N_FOTOGRAMMI - 1))); do
  "$CHROMIUM" --headless --disable-gpu --hide-scrollbars --no-sandbox \
    --screenshot="$LAVORO/frames/frame-$(printf '%03d' "$n").png" \
    --window-size=1280,720 "file://$SORGENTE?f=$n" 2>/dev/null
done
echo "Fotogrammi resi: $(find "$LAVORO/frames" -name '*.png' | wc -l)"

ffmpeg -y -loglevel error -framerate "$FPS_SORGENTE" -i "$LAVORO/frames/frame-%03d.png" \
  -vf "fps=24,format=yuv420p" -c:v libx264 -preset slow -crf 26 \
  -movflags +faststart -an "$RADICE/public/landing-demo.mp4"

cp "$LAVORO/frames/frame-$(printf '%03d' "$POSTER").png" \
  "$RADICE/public/landing-demo-fallback.png"

ls -l "$RADICE/public/landing-demo.mp4" "$RADICE/public/landing-demo-fallback.png" |
  awk '{printf "%-42s %8.1f KB\n", $9, $5/1024}'
