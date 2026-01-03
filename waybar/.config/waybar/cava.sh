#!/bin/bash
playerctl status 2>/dev/null | grep -q Playing || exit 0

for i in {1..10}; do
    pactl info >/dev/null 2>&1 && break
    sleep 0.1
done

cava -p ~/.config/cava/config-waybar | while IFS= read -r line; do
    line="${line//;/}"
    output=""
    for (( i=0; i<${#line}; i++ )); do
        char="${line:$i:1}"
        case "$char" in
            0) output+="<span foreground='#6c7086'>▁</span>";;
            1) output+="<span foreground='#89b4fa'>▂</span>";;
            2) output+="<span foreground='#89dceb'>▃</span>";;
            3) output+="<span foreground='#a6e3a1'>▄</span>";;
            4) output+="<span foreground='#f9e2af'>▅</span>";;
            5) output+="<span foreground='#fab387'>▆</span>";;
            6) output+="<span foreground='#f5c2e7'>▇</span>";;
            7) output+="<span foreground='#cba6f7'>█</span>";;
        esac
    done
    echo "$output"
done
