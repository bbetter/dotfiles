#!/bin/bash

# Check for updates using checkupdates (pacman) and yay/paru (AUR)
updates_pacman=0
updates_aur=0

# Check official repos
if command -v checkupdates &> /dev/null; then
    updates_pacman=$(checkupdates 2>/dev/null | wc -l)
fi

# Check AUR (try yay first, then paru)
if command -v yay &> /dev/null; then
    updates_aur=$(yay -Qua 2>/dev/null | wc -l)
elif command -v paru &> /dev/null; then
    updates_aur=$(paru -Qua 2>/dev/null | wc -l)
fi

total=$((updates_pacman + updates_aur))

if [ "$total" -eq 0 ]; then
    echo '{"text":"","class":"no-updates","tooltip":"System is up to date"}'
elif [ "$total" -lt 10 ]; then
    echo "{\"text\":\"  $total\",\"class\":\"updates-available\",\"tooltip\":\"$updates_pacman official, $updates_aur AUR updates available\"}"
else
    echo "{\"text\":\"  $total\",\"class\":\"updates-available critical\",\"tooltip\":\"$updates_pacman official, $updates_aur AUR updates available\"}"
fi
