#!/usr/bin/env bash
# Show Hyprland keybinds in a fuzzel menu.
# The config is now Lua (binds.lua), and Lua binds show up in `hyprctl binds`
# only as opaque `__lua <index>` entries, so we parse binds.lua directly.

set -euo pipefail
BINDS="$HOME/.config/hypr/binds.lua"
[ -f "$BINDS" ] || { echo "binds.lua not found" >&2; exit 1; }

{
    # Workspace binds come from a `for i = 1, 9` loop, not literal hl.bind lines.
    printf '%-28s  %s\n' "SUPER + 1..9 / 0"         "focus workspace N"
    printf '%-28s  %s\n' "SUPER + SHIFT + 1..9 / 0" "move window to workspace N"

    grep -E '^\s*hl\.bind\(' "$BINDS" | grep -v '" \.\. i,' | while IFS= read -r line; do
        body=${line#*hl.bind(}
        keyspec=${body%%,*}          # first arg = key spec (never contains a comma)
        action=${body#*,}            # everything after = the action

        keyspec=$(printf '%s' "$keyspec" \
            | sed -E 's/mainMod/SUPER/g; s/"//g; s/\.\.//g; s/[[:space:]]+/ /g; s/^ //; s/ $//')

        action=$(printf '%s' "$action" \
            | sed -E 's/^[[:space:]]+//; s/hl\.dsp\.?//g' \
            | sed -E 's/home \.\. "/"~/g; s/" \.\. [A-Za-z_]+ \.\. "/ /g' \
            | sed -E 's/[[:space:]]*,?[[:space:]]*\{ mouse = true \}//' \
            | sed -E 's/exec_cmd\((.*)\)[[:space:]]*$/run: \1/' \
            | sed -E 's/\(\{ direction = "([lrud])" \}\)?/→ \1/' \
            | sed -E 's/\(\{ workspace = ([^}]*)\}\)?/→ ws \1/' \
            | sed -E 's/\(\{ action = "([a-z]+)" \}\)?/→ \1/' \
            | sed -E 's/[)"'"'"']+[[:space:]]*$//; s/[[:space:]]+$//' \
            | sed -E 's/["'"'"']//g')

        printf '%-28s  %s\n' "$keyspec" "$action"
    done
} | fuzzel --dmenu -p "keybind " || true
