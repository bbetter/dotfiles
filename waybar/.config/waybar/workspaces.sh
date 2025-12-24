#!/bin/bash

# Отримуємо монітор з параметра або визначаємо автоматично
MONITOR="${1:-$(hyprctl monitors -j | jq -r '.[] | select(.focused == true) | .name')}"

# Отримуємо список workspace-ів
WORKSPACES=$(hyprctl workspaces -j)

# Отримуємо кількість моніторів
MONITOR_COUNT=$(hyprctl monitors -j | jq '. | length')

# Визначаємо максимальний workspace ID і рахуємо count
MAX_WS=$(hyprctl workspaces -j | jq -r 'max_by(.id) | .id')
COUNT=$((MAX_WS / MONITOR_COUNT))

# Визначаємо offset для ЦЬОГО монітора
MONITOR_INDEX=$(hyprctl monitors -j | jq -r --arg mon "$MONITOR" 'to_entries | .[] | select(.value.name == $mon) | .key')
OFFSET=$((MONITOR_INDEX * COUNT))

# Отримуємо активний workspace НА ЦЬОМУ МОНІТОРІ
ACTIVE_WS=$(hyprctl monitors -j | jq -r --arg mon "$MONITOR" '.[] | select(.name == $mon) | .activeWorkspace.id')

# Генеруємо список 1-COUNT
OUTPUT=""
for ((i=1; i<=COUNT; i++)); do
    REAL_ID=$((OFFSET + i))
    
    # Перевіряємо чи workspace існує
    EXISTS=$(echo "$WORKSPACES" | jq -r --arg id "$REAL_ID" '.[] | select(.id == ($id | tonumber)) | .id')
    
    # Перевіряємо чи активний
    if [ "$REAL_ID" = "$ACTIVE_WS" ]; then
        OUTPUT+="<span foreground='#33ccff' weight='bold'>[$i]</span> "
    elif [ -n "$EXISTS" ]; then
        OUTPUT+="<span foreground='#ffffff'>$i</span> "
    else
        OUTPUT+="<span foreground='#595959'>$i</span> "
    fi
done

echo "$OUTPUT"
