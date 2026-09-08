#!/bin/bash

CURRENT=$(cat ~/.config/theme/current_mode 2>/dev/null || echo "dynamic")

# ================================
# 1. витягуємо теми з wal
# ================================
WAL_THEMES=$(wal --theme 2>/dev/null |
  sed 's/\x1b\[[0-9;]*m//g' |
  grep -v "Themes" |
  grep -v "^$" |
  sed 's/^ *- //' |
  sort -u)

# ================================
# 2. фільтр сміття
# ================================
WAL_THEMES=$(echo "$WAL_THEMES" |
  grep -v "^base16-" |
  grep -v "^dkeg-" |
  grep -v "^sexy-" |
  grep -v "^random")

# ================================
# 3. dynamic варіанти зверху
# ================================
OPTIONS="dynamic (mirrored)
dynamic (per-monitor experimental)
$WAL_THEMES"

# ================================
# 4. меню
# ================================
CHOICE=$(echo "$OPTIONS" | fuzzel --dmenu --prompt "Theme > ")

[ -z "$CHOICE" ] && exit 0

# label → internal mode token
case "$CHOICE" in
"dynamic (mirrored)") MODE="dynamic" ;;
"dynamic (per-monitor experimental)") MODE="dynamic-blend" ;;
*) MODE="$CHOICE" ;;
esac

~/.config/scripts/set-theme-mode.sh "$MODE"
