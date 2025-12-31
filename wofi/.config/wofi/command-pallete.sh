#!/usr/bin/env bash

set -e

CHOICE=$(printf "%s\n" \
  "🔊 Audio" \
  "🌐 Network" \
  "🎬 Media" \
  "🖥 System" \
  "🛠 Dev" \
  "⛔ Cancel")

MENU=$(echo "$CHOICE" | /usr/bin/wofi --dmenu --prompt "Command Palette")

case "$MENU" in
  "🔊 Audio")   exec ~/.config/wofi/commands/audio.sh ;;
  "🌐 Network") exec ~/.config/wofi/commands/network.sh ;;
  "🎬 Media")   exec ~/.config/wofi/commands/media.sh ;;
  "🖥 System")  exec ~/.config/wofi/commands/system.sh ;;
  "🛠 Dev")     exec ~/.config/wofi/commands/dev.sh ;;
  *) exit 0 ;;
esac

