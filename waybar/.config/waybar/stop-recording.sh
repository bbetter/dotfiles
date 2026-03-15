#!/bin/bash

START_FILE="/tmp/wf-recorder-start"
FILE_FILE="/tmp/wf-recorder-file"
MERGE_FILE="/tmp/wf-recorder-merge"

if ! pgrep -x wf-recorder > /dev/null; then
    notify-send "🎥 Recording" "Not recording" -i dialog-information
    exit 0
fi

pkill -INT wf-recorder

if [ -f "$MERGE_FILE" ]; then
    sleep 1  # give both instances time to finalize
    FINAL="$(cat "$FILE_FILE")"
    IFS='|' read -r TMP1 TMP2 < "$MERGE_FILE"
    rm -f "$START_FILE" "$FILE_FILE" "$MERGE_FILE"
    notify-send "🎥 Merging recordings..." "Please wait"
    ffmpeg -i "$TMP1" -i "$TMP2" -filter_complex hstack -c:v libx264 -crf 23 "$FINAL" -y \
        && notify-send "🎥 Recording saved" "$FINAL" \
        && rm -f "$TMP1" "$TMP2" \
        || notify-send "🎥 Merge failed" "Temp files kept: $TMP1 $TMP2"
else
    sleep 0.3
    [ -f "$FILE_FILE" ] && notify-send "🎥 Recording saved" "$(cat "$FILE_FILE")"
    rm -f "$START_FILE" "$FILE_FILE"
fi

