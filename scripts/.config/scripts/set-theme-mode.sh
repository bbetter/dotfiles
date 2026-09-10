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

# mode-switch notifications. The actual mirror on/off is reconciled in
# apply-theme.sh so it also self-heals on boot / watcher tick.
case "$MODE" in
dynamic)
  notify-send -a theme "Dynamic theme" \
    "Wallpaper mirrored across monitors — one shared palette." 2>/dev/null || true
  ;;
dynamic-blend)
  notify-send -a theme "Dynamic theme · per-monitor (experimental)" \
    "Palette blended from every monitor's wallpaper. Per-monitor wallpapers left as they are." 2>/dev/null || true
  ;;
esac

~/.config/scripts/apply-theme.sh
