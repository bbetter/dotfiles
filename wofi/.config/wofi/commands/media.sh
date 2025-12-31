#!/bin/bash

set -e

CHOICE=$(printf "%s\n" \
  "⏯ Play / Pause" \
  "⏭ Next" \
  "⏮ Prev" \
  "🎥 Start recording (window)" \
  "⏹ Stop recording" \
  "⬅ Back" \
  | wofi --dmenu --prompt "Media")

case "$CHOICE" in
  "⏯ Play / Pause") playerctl play-pause ;;
  "⏭ Next") playerctl next ;;
  "⏮ Prev") playerctl previous ;;
  "🎥 Start recording (window)") ~/.config/waybar/start-recording-window.sh ;;
  "⏹ Stop recording") ~/.config/waybar/stop-recording.sh ;;
esac
