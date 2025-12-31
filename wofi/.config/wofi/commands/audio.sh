#!/bin/bash

set -e

CHOICE=$(printf "%s\n" \
  "🔇 Mute output" \
  "🔊 Speakers" \
  "🎧 Headphones" \
  "🎤 Mute mic" \
  "⬅ Back" \
  | wofi --dmenu --prompt "Audio")

case "$CHOICE" in
  "🔇 Mute output") wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle ;;
  "🎤 Mute mic")    wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle ;;
  "🔊 Speakers")    wpctl set-default $(wpctl status | awk '/Audio\/Sink/ {getline; print $1}') ;;
  "🎧 Headphones")  wpctl set-default $(wpctl status | grep bluez | head -n1 | awk '{print $1}') ;;
esac
