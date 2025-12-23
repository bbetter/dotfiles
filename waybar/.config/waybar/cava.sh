#!/bin/bash

# показуємо cava тільки якщо щось реально грає
playerctl status 2>/dev/null | grep -q Playing || exit 0

# чекаємо pipewire (щоб не падало на старті)
for i in {1..10}; do
    pactl info >/dev/null 2>&1 && break
    sleep 0.1
done

cava -p ~/.config/cava/config-waybar \
 | sed -u 's/;//g;
          s/0/▁/g;
          s/1/▂/g;
          s/2/▃/g;
          s/3/▄/g;
          s/4/▅/g;
          s/5/▆/g;
          s/6/▇/g;
          s/7/█/g;'

