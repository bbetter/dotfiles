#!/usr/bin/env bash
CONF="$HOME/.config/hypr/binds.conf"
[ ! -f "$CONF" ] && exit 1

# Витягуємо значення mainMod (SUPER)
MAINMOD=$(grep -E '^\$mainMod *= *' "$CONF" | awk -F= '{gsub(/ /,"",$2); print $2}')

awk -v MAINMOD="$MAINMOD" '
/^bind/ {
  line=$0
  # description (everything after #)
  desc=""
  if (match(line, /# .*/)) {
    desc=substr(line, RSTART+2)
    line=substr(line, 1, RSTART-1)
  }
  # remove "bind ="
  sub(/^bind[a-z]* *= */, "", line)
  # split by comma
  n=split(line, parts, ",")
  mods=parts[1]
  key=parts[2]
  gsub(/^[ \t]+|[ \t]+$/, "", mods)
  gsub(/^[ \t]+|[ \t]+$/, "", key)
  # replace $mainMod
  gsub(/\$mainMod/, MAINMOD, mods)
  # Human-friendly key names
  keymap["grave"]="`"
  keymap["minus"]="-"
  keymap["equal"]="="
  keymap["prior"]="PageUp"
  keymap["next"]="PageDown"
  if (key in keymap)
    key = keymap[key]
  combo = mods " + " key
  if (desc == "") desc = "(no description)"
  printf "%-30s  %s\n", combo, desc
}
' "$CONF" | fuzzel --dmenu
