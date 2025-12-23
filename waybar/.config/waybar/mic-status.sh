#!/bin/sh

if wpctl get-volume @DEFAULT_AUDIO_SOURCE@ | grep -q MUTED; then
    echo '{"text":"🎤❌","class":"muted","tooltip":"Microphone muted"}'
else
    echo '{"text":"🎤","class":"active","tooltip":"Microphone active"}'
fi

