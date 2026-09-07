#!/bin/bash

set -e

MODE=$(cat ~/.config/theme/current_mode 2>/dev/null || echo "dynamic")

echo "🎨 Applying theme mode: $MODE"

# ================================
# STATIC MODE
# ================================
if [ "$MODE" != "dynamic" ]; then
  echo "🎨 Static theme: $MODE"

  rm -rf ~/.cache/wal 2>/dev/null || true

  # fallback для base16
  wal --theme "$MODE" 2>/dev/null || wal --theme "base16-$MODE"

  ~/.config/scripts/gen-theme.sh

  hyprctl reload

  echo "✅ Static theme applied"
  exit 0
fi

# ================================
# DYNAMIC MODE
# ================================
echo "🌈 Dynamic theme (DP-2 dominant)"

WALL_ID=$(wall status | awk '/DP-2/{f=1} f && /id:/{print $2; exit}')

[ -z "$WALL_ID" ] && {
  echo "❌ Failed to get wallpaper ID"
  exit 1
}

BASE="$STEAM_LIB/workshop/content/431960/$WALL_ID"

[ ! -d "$BASE" ] && {
  echo "❌ Path not found: $BASE"
  exit 1
}

IMG="/tmp/wall-$(date +%s).png"

PREVIEW=$(find "$BASE" -type f \( -name "preview.jpg" -o -name "preview.png" \) | head -n1)

if [ -n "$PREVIEW" ]; then
  cp "$PREVIEW" "$IMG"
else
  VIDEO=$(find "$BASE" -type f \( -name "*.mp4" -o -name "*.webm" -o -name "*.gif" \) | head -n1)
  [ -z "$VIDEO" ] && {
    echo "❌ No media"
    exit 1
  }

  ffmpeg -y -loglevel quiet -ss 1 -i "$VIDEO" -vframes 1 "$IMG"
fi

[ ! -s "$IMG" ] && {
  echo "❌ Bad image"
  exit 1
}

rm -rf ~/.cache/wal 2>/dev/null || true

wal -i "$IMG" --backend colorz --saturate 0.4 -n

~/.config/scripts/gen-theme.sh

hyprctl reload

echo "✅ Dynamic theme applied"
