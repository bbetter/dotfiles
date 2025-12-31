#!/bin/bash

set -e

MENU=$(printf "%s\n" \
  "🐳 Docker status" \
  "🐳 Docker stop all" \
  "📦 Update system (pacman)" \
  "📦 Update AUR (yay)" \
  "🧹 Clear caches" \
  "📜 Journal (errors)" \
  "⬅ Back")

CHOICE=$(echo "$MENU" | wofi --dmenu --prompt "Dev")

case "$CHOICE" in
  "🐳 Docker status")
      notify-send "Docker" "$(docker ps --format '{{.Names}}')" ;;
  "🐳 Docker stop all")
      docker stop $(docker ps -q) ;;
  "📦 Update system (pacman)")
      ghostty -e sudo pacman -Syu ;;
  "📦 Update AUR (yay)")
      ghostty -e yay -Syu ;;
  "🧹 Clear caches")
      ghostty -e bash -c "rm -rf ~/.cache/* && echo Done; read" ;;
  "📜 Journal (errors)")
      ghostty -e journalctl -p 3 -xb ;;
esac
