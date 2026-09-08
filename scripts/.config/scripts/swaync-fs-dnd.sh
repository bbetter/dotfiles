#!/usr/bin/env bash
# Suppress swaync notification pop-ups while any window is fullscreen (games,
# video). They still collect in the control center. Driven by Hyprland's
# socket2 `fullscreen>>` events.

SOCK="${XDG_RUNTIME_DIR}/hypr/${HYPRLAND_INSTANCE_SIGNATURE}/.socket2.sock"
[ -S "$SOCK" ] || exit 0

fs=0
socat -U - "UNIX-CONNECT:$SOCK" 2>/dev/null | while IFS= read -r line; do
  case "$line" in
    fullscreen\>\>1)
      [ "$fs" = 0 ] && swaync-client --inhibitor-add fullscreen --skip-wait
      fs=1
      ;;
    fullscreen\>\>0)
      [ "$fs" = 1 ] && swaync-client --inhibitor-remove fullscreen --skip-wait
      fs=0
      ;;
  esac
done
