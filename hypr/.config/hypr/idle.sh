#!/usr/bin/env bash
# Idle management: lock after 5 min, blank screens after 10, lock before sleep.
# Uses swayidle + swaylock (hypridle/hyprlock are not installed on this system).

pkill -x swayidle 2>/dev/null
sleep 0.2

exec swayidle -w \
  timeout 300  "swaylock -f" \
  timeout 600  "hyprctl dispatch dpms off" \
       resume  "hyprctl dispatch dpms on" \
  before-sleep "swaylock -f" \
  lock         "swaylock -f"
