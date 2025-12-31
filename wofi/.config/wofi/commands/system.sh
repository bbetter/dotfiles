#!/bin/bash

set -e

CHOICE=$(printf "%s\n" \
  "🔄 Reload Hyprland" \
  "📊 Restart Waybar" \
  "🔵 Restart Bluetooth" \
  "🔊 Restart PipeWire" \
  "🔒 Lock screen" \
  "⏻ Logout" \
  "⬅ Back" \
  | wofi --dmenu --prompt "System")

case "$CHOICE" in
  "🔄 Reload Hyprland") hyprctl reload ;;
  "📊 Restart Waybar") pkill waybar && waybar ;;
  "🔵 Restart Bluetooth") systemctl restart bluetooth ;;
  "🔊 Restart PipeWire") systemctl --user restart pipewire pipewire-pulse ;;
  "🔒 Lock screen") swaylock ;;
  "⏻ Logout") hyprctl dispatch exit ;;
esac
