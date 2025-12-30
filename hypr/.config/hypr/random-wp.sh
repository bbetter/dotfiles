#!/usr/bin/env bash
set -euo pipefail

WALLDIR="$HOME/Картинки/Wallpapers"

# --- перевірки ---
if ! pgrep -x hyprpaper >/dev/null; then
    echo "[wallpaper] hyprpaper не запущений" >&2
    exit 1
fi

if [[ ! -d "$WALLDIR" ]]; then
    echo "[wallpaper] директорія не існує: $WALLDIR" >&2
    exit 1
fi

# --- знайти випадкову картинку ---
wall=$(find "$WALLDIR" -type f \( \
    -iname "*.jpg" -o \
    -iname "*.jpeg" -o \
    -iname "*.png" -o \
    -iname "*.webp" \
\) | shuf -n1)

if [[ -z "${wall:-}" ]]; then
    echo "[wallpaper] не знайдено жодного файлу" >&2
    exit 1
fi

# --- preload + apply ---
hyprctl hyprpaper preload "$wall"
hyprctl hyprpaper wallpaper ",$wall"

echo "[wallpaper] встановлено: $wall"

