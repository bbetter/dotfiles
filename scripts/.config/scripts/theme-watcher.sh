#!/bin/bash

LAST_ID=""

while true; do
  MODE=$(cat ~/.config/theme/current_mode 2>/dev/null || echo "dynamic")

  # ❗ працює тільки в dynamic
  if [ "$MODE" != "dynamic" ]; then
    sleep 2
    continue
  fi

  CURRENT_ID=$(wall status | awk '/DP-2/{f=1} f && /id:/{print $2; exit}')

  if [ -n "$CURRENT_ID" ] && [ "$CURRENT_ID" != "$LAST_ID" ]; then
    echo "🎨 Wallpaper changed: $CURRENT_ID"

    ~/.config/scripts/apply-theme.sh

    LAST_ID="$CURRENT_ID"
  fi

  sleep 1
done
