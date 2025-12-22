#!/bin/bash

STATE_FILE="/tmp/wf-recorder-state"

if pgrep -x wf-recorder > /dev/null; then
    killall -INT wf-recorder
    sleep 1
    
    if [ -f "$STATE_FILE" ]; then
        FILE=$(cat "$STATE_FILE")
        notify-send "🎥 Recording stopped" "Saved to:\n$FILE" -i video-x-generic
        rm "$STATE_FILE"
    else
        notify-send "🎥 Recording stopped" -i video-x-generic
    fi
else
    notify-send "🎥 No recording" "Nothing to stop" -i dialog-information
fi
