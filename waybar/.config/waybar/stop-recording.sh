#!/bin/bash

START_FILE="/tmp/wf-recorder-start"
FILE_FILE="/tmp/wf-recorder-file"

if ! pgrep -x wf-recorder > /dev/null; then
    notify-send "🎥 Recording" "Not recording" -i dialog-information
    exit 0
fi

pkill -INT wf-recorder

sleep 0.3

[ -f "$FILE_FILE" ] && notify-send "🎥 Recording saved" "$(cat "$FILE_FILE")"

rm -f "$START_FILE" "$FILE_FILE"

