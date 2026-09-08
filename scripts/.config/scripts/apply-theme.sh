#!/bin/bash

set -e

MODE=$(cat ~/.config/theme/current_mode 2>/dev/null || echo "dynamic")

echo "🎨 Applying theme mode: $MODE"

# ================================
# STATIC MODE
# ================================
case "$MODE" in
dynamic | dynamic-blend) ;; # dynamic family — handled below
*)
  echo "🎨 Static theme: $MODE"

  rm -rf ~/.cache/wal 2>/dev/null || true

  # fallback для base16
  wal --theme "$MODE" 2>/dev/null || wal --theme "base16-$MODE"

  ~/.config/scripts/gen-theme.sh

  hyprctl reload

  echo "✅ Static theme applied"
  exit 0
  ;;
esac

# ================================
# DYNAMIC FAMILY
#   dynamic       — one palette, wallpaper mirrored across every monitor
#   dynamic-blend — palette blended from every monitor's own wallpaper
#                   (per-monitor wallpapers left untouched) — experimental
# ================================

STEAM_LIB="${STEAM_LIB:-$HOME/.local/share/Steam/steamapps}"
WORKSHOP="$STEAM_LIB/workshop/content/431960"
TS=$(date +%s)

# id of the wallpaper currently on <monitor>
wall_id_for() {
  wall status | awk -v m="monitor: $1" '
    $0 ~ m {f=1; next}
    f && /id:/ {print $2; exit}'
}

# extract a still frame for <monitor>'s current wallpaper into <outfile>;
# non-zero if nothing usable was found
frame_for_monitor() {
  local mon="$1" out="$2" id base preview video
  id=$(wall_id_for "$mon")
  [ -z "$id" ] && {
    echo "  ⚠️  no wallpaper id for $mon"
    return 1
  }
  base="$WORKSHOP/$id"
  [ -d "$base" ] || {
    echo "  ⚠️  workshop path missing: $base"
    return 1
  }

  preview=$(find "$base" -type f \
    \( -iname 'preview.jpg' -o -iname 'preview.jpeg' \
    -o -iname 'preview.png' -o -iname 'preview.gif' \) | head -n1)

  if [ -n "$preview" ]; then
    magick "${preview}[0]" "$out" 2>/dev/null || cp "$preview" "$out"
  else
    video=$(find "$base" -type f \
      \( -name '*.mp4' -o -name '*.webm' -o -name '*.mkv' \) | head -n1)
    [ -z "$video" ] && {
      echo "  ⚠️  no media in $base"
      return 1
    }
    ffmpeg -y -loglevel quiet -ss 1 -i "$video" -vframes 1 "$out"
  fi

  [ -s "$out" ]
}

# keep every non-DP-2 monitor on DP-2's wallpaper (mirror mode only).
# best-effort — a failure here must not abort the recolor.
mirror_wallpaper() {
  local dp2 cur m
  dp2=$(wall_id_for "DP-2")
  [ -z "$dp2" ] && return 0
  for m in $(wall monitors); do
    [ "$m" = "DP-2" ] && continue
    cur=$(wall_id_for "$m")
    [ "$cur" = "$dp2" ] && continue
    wall "$dp2" "$m" >/dev/null 2>&1 || true
  done
  return 0
}

if [ "$MODE" = "dynamic-blend" ]; then
  echo "🌈 Dynamic — per-monitor blend (experimental)"

  FRAMES=()
  for m in $(wall monitors); do
    f="/tmp/wall-${m}-${TS}.png"
    if frame_for_monitor "$m" "$f"; then
      FRAMES+=("$f")
      echo "  ✓ $m"
    fi
  done

  [ ${#FRAMES[@]} -eq 0 ] && {
    echo "❌ no frames collected"
    exit 1
  }

  IMG="/tmp/wall-blend-${TS}.png"
  if [ ${#FRAMES[@]} -eq 1 ]; then
    cp "${FRAMES[0]}" "$IMG"
  else
    # equal-height, stitched side by side → each monitor's wallpaper
    # contributes roughly equally to the extracted palette
    magick "${FRAMES[@]}" -resize x1080 +append "$IMG"
  fi
else
  echo "🌈 Dynamic — mirrored (DP-2 dominant)"
  IMG="/tmp/wall-${TS}.png"
  frame_for_monitor "DP-2" "$IMG" || {
    echo "❌ failed to get DP-2 frame"
    exit 1
  }
fi

[ -s "$IMG" ] || {
  echo "❌ bad image"
  exit 1
}

rm -rf ~/.cache/wal 2>/dev/null || true

wal -i "$IMG" --backend colorz --saturate 0.4 -n

~/.config/scripts/gen-theme.sh

hyprctl reload

# re-sync the other monitors after the recolor so a slow `wall` call
# never delays the visible theme change
[ "$MODE" = "dynamic" ] && mirror_wallpaper

echo "✅ Dynamic theme applied ($MODE)"
