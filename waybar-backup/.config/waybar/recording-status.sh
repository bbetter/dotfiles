#!/bin/bash

START_FILE="/tmp/wf-recorder-start"

if ! pgrep -x wf-recorder > /dev/null; then
    exit 0
fi

[ ! -f "$START_FILE" ] && date +%s > "$START_FILE"

START_TIME=$(cat "$START_FILE")
NOW=$(date +%s)
ELAPSED=$((NOW - START_TIME))

H=$((ELAPSED / 3600))
M=$(((ELAPSED % 3600) / 60))
S=$((ELAPSED % 60))

if [ $H -gt 0 ]; then
    TIME=$(printf "%02d:%02d:%02d" $H $M $S)
else
    TIME=$(printf "%02d:%02d" $M $S)
fi

echo "{\"text\":\"🔴 $TIME\", \"class\":\"recording\", \"tooltip\":\"Click to stop recording\"}"

