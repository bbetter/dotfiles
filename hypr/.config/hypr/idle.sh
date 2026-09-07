#!/usr/bin/env bash
# Idle management: lock after 5 min, blank screens after 10, lock before sleep.
# Uses swayidle + swaylock (hypridle/hyprlock are not installed on this system).
#
# The AGS sidebar's "Keep awake" toggle creates/removes GUARD; while it exists
# the idle lock and screen-blank are skipped (before-sleep / manual lock still
# fire).

GUARD="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/ags-keep-awake"

pkill -x swayidle 2>/dev/null
sleep 0.2

exec swayidle -w \
  timeout 300  "[ -e '$GUARD' ] || swaylock -f" \
  timeout 600  "[ -e '$GUARD' ] || hyprctl dispatch dpms off" \
       resume  "hyprctl dispatch dpms on" \
  before-sleep "swaylock -f" \
  lock         "swaylock -f"
