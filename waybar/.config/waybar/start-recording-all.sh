#!/bin/bash

START_FILE="/tmp/wf-recorder-start"
FILE_FILE="/tmp/wf-recorder-file"
DIR="$HOME/Відео/Recordings"

mkdir -p "$DIR"

if pgrep -x wf-recorder >/dev/null; then
    notify-send "🎥 Recording" "Already running"
    exit 1
fi

FILE="$DIR/all_$(date +'%Y-%m-%d_%H-%M-%S').mp4"

date +%s > "$START_FILE"
echo "$FILE" > "$FILE_FILE"

notify-send "🎥 Recording all monitors" "Everything is being captured"

# 👇 заміни на СВОЇ монітори
wf-recorder -o DP-2 -o HDMI-A-1 -f "$FILE" &
