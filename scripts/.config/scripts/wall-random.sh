#!/bin/bash

# Mode-aware "random wallpaper" for the SUPER+SHIFT+P bind.
#
#   dynamic (mirrored) → pick ONE random wallpaper and put it on every
#                        monitor in a single shot (no mid-swap flash)
#   dynamic-blend / static / anything else → per-monitor random, as `wall
#                        random` does natively (each screen its own pick)

WALL="$HOME/.local/bin/wall"
MODE=$(cat "$HOME/.config/theme/current_mode" 2>/dev/null || echo "dynamic")

wall_id_for() {
  "$WALL" status | awk -v m="monitor: $1" '
    $0 ~ m {f=1; next}
    f && /id:/ {print $2; exit}'
}

if [ "$MODE" = "dynamic" ]; then
  # roll on DP-2 only, then mirror its new id everywhere else
  "$WALL" random DP-2 >/dev/null 2>&1

  NEW_ID=""
  for _ in 1 2 3 4 5; do
    NEW_ID=$(wall_id_for "DP-2")
    [ -n "$NEW_ID" ] && break
    sleep 0.2
  done

  if [ -n "$NEW_ID" ]; then
    for m in $("$WALL" monitors); do
      [ "$m" = "DP-2" ] && continue
      "$WALL" "$NEW_ID" "$m" >/dev/null 2>&1 || true
    done
  fi
else
  "$WALL" random
fi
