#!/bin/bash

START_FILE="/tmp/wf-recorder-start"
FILE_FILE="/tmp/wf-recorder-file"
DIR="$HOME/Відео/Recordings"

mkdir -p "$DIR"

if pgrep -x wf-recorder >/dev/null; then
    notify-send "🎥 Recording" "Already running"
    exit 1
fi

WIN_JSON=$(hyprctl activewindow -j 2>/dev/null)

[ -z "$WIN_JSON" ] && notify-send "❌ Recording" "No active window" && exit 1

X=$(echo "$WIN_JSON" | jq -r '.at[0]')
Y=$(echo "$WIN_JSON" | jq -r '.at[1]')
W=$(echo "$WIN_JSON" | jq -r '.size[0]')
H=$(echo "$WIN_JSON" | jq -r '.size[1]')

GEOM="${X},${Y} ${W}x${H}"

FILE="$DIR/window_$(date +'%Y-%m-%d_%H-%M-%S').mp4"

date +%s > "$START_FILE"
echo "$FILE" > "$FILE_FILE"

notify-send "🎥 Recording window" "Geometry: $GEOM"

wf-recorder -g "$GEOM" -f "$FILE" &
