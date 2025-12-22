#!/bin/bash

if pgrep -x waybar > /dev/null; then
    # Waybar запущений - вбиваємо
    killall waybar
else
    # Waybar не запущений - запускаємо
    waybar &
fi

