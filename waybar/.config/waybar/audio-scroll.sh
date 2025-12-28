#!/bin/bash

DEVICE="$1"
DIRECTION="$2"

if [ "$DEVICE" = "mic" ]; then
    if [ "$DIRECTION" = "up" ]; then
        pactl set-source-volume @DEFAULT_SOURCE@ +5%
    else
        pactl set-source-volume @DEFAULT_SOURCE@ -5%
    fi
elif [ "$DEVICE" = "speaker" ]; then
    if [ "$DIRECTION" = "up" ]; then
        pactl set-sink-volume @DEFAULT_SINK@ +5%
    else
        pactl set-sink-volume @DEFAULT_SINK@ -5%
    fi
fi
