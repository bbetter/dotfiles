#!/bin/bash

# Встанови fd якщо немає: sudo pacman -S fd

# Пошук файлів через fd
file=$(fd . $HOME --type f --max-depth 5 --hidden --exclude .git --exclude .cache | wofi --dmenu --prompt "📁 Open file:")

# Відкрити вибраний файл
if [ -n "$file" ]; then
    xdg-open "$file" &
fi
