#!/bin/bash

STATE_FILE="/tmp/wf-recorder-state"

if pgrep -x wf-recorder > /dev/null; then
    START_TIME=$(stat -c %Y "$STATE_FILE" 2>/dev/null || date +%s)
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    HOURS=$((ELAPSED / 3600))
    MINUTES=$(((ELAPSED % 3600) / 60))
    SECONDS=$((ELAPSED % 60))
    
    if [ $HOURS -gt 0 ]; then
        TIME_STR=$(printf "%02d:%02d:%02d" $HOURS $MINUTES $SECONDS)
    else
        TIME_STR=$(printf "%02d:%02d" $MINUTES $SECONDS)
    fi
    
    echo "{\"text\":\"🔴 $TIME_STR\", \"class\":\"recording\", \"tooltip\":\"Click to stop recording\"}"
else
    echo "{\"text\":\"\", \"class\":\"idle\"}"
fi
