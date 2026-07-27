#!/usr/bin/env bash
# =============================================================================
#  check-themes.sh — prueft alle Landing-Theme-Vorlagen auf die Fehler, die
#  bei "Nebula Flux" aufgetreten sind.  NUR LESEND, keine DB noetig.
#
#    bash scripts/check-themes.sh
#
#  Geprueft wird je Theme:
#    1) Platzhalter {{...}} vorhanden?      (ohne sie wird nichts ersetzt)
#    2) data-editable ohne {{...}}?         (wird vom Renderer ignoriert)
#    3) Impressum + Datenschutz verlinkt?   (Pflicht)
#    4) meta.json <-> Template konsistent?  (fehlende / ueberzaehlige Slots)
# =============================================================================
set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"
DIR="src/landing-themes"
BUILTIN="impressum_url datenschutz_url landing_domain logo_image favicon_image"

echo "=============================================================="
echo " THEME-CHECK  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================================="
fail=0
for d in "$DIR"/theme-*/; do
  name=$(basename "$d"); tpl="$d/template.html"; meta="$d/meta.json"
  [ -f "$tpl" ] || { echo "$name  !! template.html fehlt"; fail=1; continue; }
  probs=()

  ph=$(grep -o '{{[a-z0-9_]*}}' "$tpl" | sort -u | tr -d '{}')
  [ -z "$ph" ] && probs+=("keine Platzhalter — Eingaben werden NICHT uebernommen")

  de=$(grep -c 'data-editable' "$tpl")
  [ "$de" -gt 0 ] && probs+=("$de x data-editable (wird vom Renderer ignoriert)")

  grep -q 'impressum_url\|href="/impressum\|id="impressum' "$tpl" || probs+=("Impressum nicht verlinkt")
  grep -q 'datenschutz_url\|href="/datenschutz\|id="datenschutz' "$tpl" || probs+=("Datenschutz nicht verlinkt")

  dead=$(grep -o 'href="#"' "$tpl" | wc -l | tr -d ' ')
  [ "$dead" -gt 1 ] && probs+=("$dead tote Links (href=\"#\")")

  if [ -f "$meta" ]; then
    keys=$(grep -o '"key"[[:space:]]*:[[:space:]]*"[a-z0-9_]*"' "$meta" | sed 's/.*"\([a-z0-9_]*\)"$/\1/' | sort -u)
    miss=""; for k in $ph; do
      case " $BUILTIN " in *" $k "*) continue;; esac
      grep -qx "$k" <<<"$keys" || miss="$miss $k"
    done
    [ -n "$miss" ] && probs+=("Platzhalter ohne meta.json-Slot:$miss")
    unused=""; for k in $keys; do grep -qx "$k" <<<"$ph" || unused="$unused $k"; done
    [ -n "$unused" ] && probs+=("Slots ohne Platzhalter im Template:$unused")
  else
    probs+=("meta.json fehlt")
  fi

  n=$(printf '%s\n' "$ph" | grep -c . )
  if [ ${#probs[@]} -eq 0 ]; then
    printf '%-32s OK    %s Platzhalter\n' "$name" "$n"
  else
    fail=1
    printf '%-32s !!    %s Platzhalter\n' "$name" "$n"
    for p in "${probs[@]}"; do echo "                                 - $p"; done
  fi
done
echo
[ "$fail" = 0 ] && echo "Alle Themes in Ordnung." || echo "Mit !! markierte Themes muessen korrigiert werden."
