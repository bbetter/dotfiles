#!/bin/bash

MODE="$1"
FILE="$HOME/.config/theme/current_mode"

[ -z "$MODE" ] && exit 1

echo "$MODE" >"$FILE"

echo "🔁 Switched to: $MODE"

# NOT dynamic → kill the watcher; dynamic → (re)start it if it died
if [ "$MODE" != "dynamic" ]; then
  pkill -f theme-watcher.sh 2>/dev/null || true
else
  pgrep -f theme-watcher.sh >/dev/null 2>&1 ||
    setsid -f "$HOME/.config/scripts/theme-watcher.sh" >/dev/null 2>&1
fi

~/.config/scripts/apply-theme.sh
