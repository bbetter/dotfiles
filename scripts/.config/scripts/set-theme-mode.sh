#!/bin/bash

MODE="$1"
FILE="$HOME/.config/theme/current_mode"

[ -z "$MODE" ] && exit 1

echo "$MODE" >"$FILE"

echo "🔁 Switched to: $MODE"

# якщо НЕ dynamic → вбиваємо watcher
if [ "$MODE" != "dynamic" ]; then
  pkill -f theme-watcher.sh 2>/dev/null || true
fi

~/.config/scripts/apply-theme.sh
