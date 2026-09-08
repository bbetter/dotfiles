#!/bin/bash

MODE="$1"
FILE="$HOME/.config/theme/current_mode"

[ -z "$MODE" ] && exit 1

echo "$MODE" >"$FILE"

echo "🔁 Switched to: $MODE"

# dynamic family → keep the watcher alive; anything else → stop it
case "$MODE" in
dynamic | dynamic-blend)
  pgrep -f theme-watcher.sh >/dev/null 2>&1 ||
    setsid -f "$HOME/.config/scripts/theme-watcher.sh" >/dev/null 2>&1
  ;;
*)
  pkill -f theme-watcher.sh 2>/dev/null || true
  ;;
esac

# mode-switch side effects
if [ "$MODE" = "dynamic" ]; then
  # mirror DP-2's wallpaper onto every other monitor for one shared palette
  DP2_ID=$(wall status | awk '/monitor: DP-2/{f=1} f && /id:/{print $2; exit}')
  if [ -n "$DP2_ID" ]; then
    for m in $(wall monitors); do
      [ "$m" = "DP-2" ] && continue
      wall "$DP2_ID" "$m" >/dev/null 2>&1 || true
    done
  fi
  notify-send -a theme "Dynamic theme" \
    "Wallpaper mirrored across monitors — one shared palette." 2>/dev/null || true
elif [ "$MODE" = "dynamic-blend" ]; then
  notify-send -a theme "Dynamic theme · per-monitor (experimental)" \
    "Palette blended from every monitor's wallpaper. Per-monitor wallpapers left as they are." 2>/dev/null || true
fi

~/.config/scripts/apply-theme.sh
