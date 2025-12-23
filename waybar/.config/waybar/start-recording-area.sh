#!/bin/bash

START_FILE="/tmp/wf-recorder-start"
FILE_FILE="/tmp/wf-recorder-file"
DIR="$HOME/Відео/Recordings"

mkdir -p "$DIR"

if pgrep -x wf-recorder >/dev/null; then
    notify-send "🎥 Recording" "Already running"
    exit 1
fi

GEOM=$(slurp) || exit 1
FILE="$DIR/area_$(date +'%Y-%m-%d_%H-%M-%S').mp4"

date +%s > "$START_FILE"
echo "$FILE" > "$FILE_FILE"

notify-send "🎥 Recording area" "Select region"

wf-recorder -g "$GEOM" -f "$FILE" &

