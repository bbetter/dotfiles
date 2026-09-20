#!/bin/sh
# SUPER+middle-click: force keyboard focus onto whatever is under the cursor.
# With misc.mouse_move_focuses_monitor=false, hovering another monitor while a
# game is fullscreen leaves focus on the game (so volume keys / typing still go
# there). This is the explicit override: focus the topmost visible window under
# the pointer, or just the monitor if it's empty desktop.
cur=$(hyprctl cursorpos -j) || exit 1
mons=$(hyprctl monitors -j)
clients=$(hyprctl clients -j)

addr=$(jq -nr --argjson c "$cur" --argjson m "$mons" --argjson w "$clients" '
  ($m | map(select($c.x >= .x and $c.x < .x + (.width / .scale)
               and $c.y >= .y and $c.y < .y + (.height / .scale))) | .[0]) as $mon
  | if $mon == null then empty else
      [ $w[] | select(.mapped and (.hidden | not)
                and (.workspace.id == $mon.activeWorkspace.id
                     or .workspace.id == $mon.specialWorkspace.id)
                and $c.x >= .at[0] and $c.x < .at[0] + .size[0]
                and $c.y >= .at[1] and $c.y < .at[1] + .size[1]) ]
      | sort_by(.focusHistoryID) | (.[0].address // ("mon:" + $mon.name))
    end')

case "$addr" in
    "") exit 0 ;;
    mon:*) hyprctl dispatch "hl.dsp.focus({ monitor = \"${addr#mon:}\" })" ;;
    *)     hyprctl dispatch "hl.dsp.focus({ window = \"address:$addr\" })" ;;
esac
