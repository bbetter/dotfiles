#!/bin/bash

START_FILE="/tmp/wf-recorder-start"
FILE_FILE="/tmp/wf-recorder-file"
MERGE_FILE="/tmp/wf-recorder-merge"
DIR="$HOME/Відео/Recordings"

mkdir -p "$DIR"

if pgrep -x wf-recorder >/dev/null; then
    notify-send "🎥 Recording" "Already running"
    exit 1
fi

TIMESTAMP=$(date +'%Y-%m-%d_%H-%M-%S')
FILE="$DIR/all_${TIMESTAMP}.mp4"
TMP1="$DIR/.tmp_dp2_${TIMESTAMP}.mp4"
TMP2="$DIR/.tmp_hdmi_${TIMESTAMP}.mp4"

date +%s > "$START_FILE"
echo "$FILE" > "$FILE_FILE"
echo "$TMP1|$TMP2" > "$MERGE_FILE"

notify-send "🎥 Recording all monitors" "Everything is being captured"

wf-recorder -o DP-2 -f "$TMP1" &
wf-recorder -o HDMI-A-1 -f "$TMP2" &
