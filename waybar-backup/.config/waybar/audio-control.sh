#!/bin/bash

# Кольори
COLOR_GOOD="#98fb98"
COLOR_MUTED="#f38ba8"

# Отримуємо default sink (speakers/headphones)
SINK_VOL=$(pactl get-sink-volume @DEFAULT_SINK@ | grep -oP '\d+%' | head -1 | tr -d '%')
SINK_MUTE=$(pactl get-sink-mute @DEFAULT_SINK@ | grep -oP 'yes|no')

# Формуємо вивід
if [ "$SINK_MUTE" = "yes" ]; then
    HTML="<span foreground='$COLOR_MUTED'>󰖁 Muted</span>"
    TOOLTIP="Volume: Muted\nScroll to adjust\nClick for Pavucontrol\nRight Click to unmute"
else
    HTML="🔊 <span foreground='$COLOR_GOOD'>${SINK_VOL}%</span>"
    TOOLTIP="Volume: ${SINK_VOL}%\nScroll to adjust\nClick for Pavucontrol\nRight Click to mute"
fi

# JSON output
echo "{\"text\":\"$HTML\",\"tooltip\":\"$TOOLTIP\"}"
