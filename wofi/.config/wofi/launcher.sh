#!/bin/bash

mode="$1"  # drun, run, або files

# Якщо wofi вже запущений
if pgrep -x wofi > /dev/null; then
    # Вбити старий wofi
    killall wofi
    sleep 0.1
fi

# Запустити wofi в потрібному режимі
case "$mode" in
    drun)
        wofi --show drun
        ;;
    run)
        wofi --show run
        ;;
    files)
        # Пошук файлів
        file=$(fd . $HOME --type f --max-depth 5 --hidden --exclude .git --exclude .cache | wofi --dmenu --prompt "📁 Open file:")
        if [ -n "$file" ]; then
            xdg-open "$file" &
        fi
        ;;
esac
