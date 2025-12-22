#!/bin/bash

STATE_FILE="/tmp/wf-recorder-state"
RECORDINGS_DIR=~/Відео/Recordings
mkdir -p "$RECORDINGS_DIR"

if pgrep -x wf-recorder > /dev/null; then
    notify-send "🎥 Recording" "Already recording!" -i dialog-warning
else
    FILENAME="$RECORDINGS_DIR/recording_$(date +'%Y-%m-%d_%H-%M-%S.mp4')"
    echo "$FILENAME" > "$STATE_FILE"
    notify-send "🎥 Recording started" "Press to stop in waybar or Super+F10" -i media-record
    wf-recorder -f "$FILENAME" &
fi
