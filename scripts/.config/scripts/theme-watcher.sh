#!/bin/bash

# Watches the active wallpaper(s) and re-runs apply-theme.sh when they change.
# Only does anything in the dynamic family:
#   dynamic       — watches DP-2's wallpaper id
#   dynamic-blend — watches every monitor's id (recolor on any change)

LAST_SIG=""

sig_for_mode() {
  case "$1" in
  dynamic)
    wall status | awk '/monitor: DP-2/{f=1} f && /id:/{print $2; exit}'
    ;;
  dynamic-blend)
    wall status | awk '/id:/{print $2}' | paste -sd, -
    ;;
  esac
}

while true; do
  MODE=$(cat ~/.config/theme/current_mode 2>/dev/null || echo "dynamic")

  case "$MODE" in
  dynamic | dynamic-blend) ;;
  *)
    sleep 2
    continue
    ;;
  esac

  SIG=$(sig_for_mode "$MODE")

  if [ -n "$SIG" ] && [ "$SIG" != "$LAST_SIG" ]; then
    echo "🎨 Wallpaper changed ($MODE): $SIG"
    ~/.config/scripts/apply-theme.sh
    LAST_SIG="$SIG"
  fi

  sleep 1
done
