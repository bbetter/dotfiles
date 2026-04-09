#!/bin/bash

# Check for updates using checkupdates (pacman) and yay/paru (AUR)
updates_pacman=0
updates_aur=0

# Check official repos
if command -v checkupdates &> /dev/null; then
    updates_pacman=$(checkupdates 2>/dev/null | wc -l)
fi

# Check AUR
if command -v yay &> /dev/null; then
    updates_aur=$(yay -Qua 2>/dev/null | wc -l)
elif command -v paru &> /dev/null; then
    updates_aur=$(paru -Qua 2>/dev/null | wc -l)
fi

total=$((updates_pacman + updates_aur))

# Build JSON with individual counts
echo "{\"total\": $total, \"pacman\": $updates_pacman, \"aur\": $updates_aur, \"text\": \"$total\", \"tooltip\": \"Pacman: $updates_pacman, AUR: $updates_aur\"}"
