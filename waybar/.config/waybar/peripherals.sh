#!/bin/bash

SEP="<span foreground='#6c7086'>│</span>"

# Кольори батареї
COLOR_GOOD="#a6e3a1"
COLOR_MEDIUM="#f9e2af"
COLOR_LOW="#fab387"
COLOR_CRITICAL="#f38ba8"

# Tracking оброблених пристроїв
declare -A PROCESSED

# Масиви для збору пристроїв
declare -a DEVICES_WITH_BATTERY
declare -a DEVICES_WITHOUT_BATTERY

# Функція для отримання кольору батареї
get_battery_color() {
    local pct=$1
    if [ $pct -gt 80 ]; then echo "$COLOR_GOOD"
    elif [ $pct -gt 50 ]; then echo "$COLOR_MEDIUM"
    elif [ $pct -gt 20 ]; then echo "$COLOR_LOW"
    else echo "$COLOR_CRITICAL"; fi
}

# Функція збору пристрою
collect_device() {
    local emoji="$1"
    local battery="$2"
    local tooltip_text="$3"
    
    local device_html=""
    
    if [ -n "$battery" ]; then
        local color=$(get_battery_color "$battery")
        device_html="$emoji <span foreground='$color'>${battery}%</span>"
        DEVICES_WITH_BATTERY+=("$device_html|||$tooltip_text")
    else
        device_html="$emoji"
        DEVICES_WITHOUT_BATTERY+=("$device_html|||$tooltip_text")
    fi
}

# ==============================================================================
# 1. KNOWN_DEVICES (швидкий whitelist)
# ==============================================================================
declare -A KNOWN_DEVICES=(
    ["80:C3:BA:3F:FB:12"]="🎧|MOMENTUM 4|Headset"
    ["379a:0300"]="⌨️|Rockfall 3 Wireless|Keyboard"
)

# Обробка Bluetooth devices з KNOWN_DEVICES
for MAC in "${!KNOWN_DEVICES[@]}"; do
    [[ ! "$MAC" =~ ^[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}$ ]] && continue
    
    if bluetoothctl info "$MAC" 2>/dev/null | grep -q "Connected: yes"; then
        IFS='|' read -r EMOJI NAME TYPE <<< "${KNOWN_DEVICES[$MAC]}"
        BATTERY=$(bluetoothctl info "$MAC" 2>/dev/null | grep "Battery Percentage:" | grep -oP '\(\K[0-9]+(?=\))')
        
        TOOLTIP_TEXT="$NAME ($TYPE)\n"
        [ -n "$BATTERY" ] && TOOLTIP_TEXT="${TOOLTIP_TEXT}Battery: ${BATTERY}%\n"
        TOOLTIP_TEXT="${TOOLTIP_TEXT}MAC: $MAC"
        
        collect_device "$EMOJI" "$BATTERY" "$TOOLTIP_TEXT"
        PROCESSED["$MAC"]=1
    fi
done

# Обробка USB devices з KNOWN_DEVICES
for VP_ID in "${!KNOWN_DEVICES[@]}"; do
    [[ ! "$VP_ID" =~ ^[0-9A-Fa-f]{4}:[0-9A-Fa-f]{4}$ ]] && continue
    
    VP_UPPER="${VP_ID^^}"
    
    if ls /sys/bus/hid/devices/*${VP_UPPER}* &>/dev/null; then
        IFS='|' read -r EMOJI NAME TYPE <<< "${KNOWN_DEVICES[$VP_ID]}"
        TOOLTIP_TEXT="$NAME ($TYPE)\nUSB: ${VP_ID}"
        collect_device "$EMOJI" "" "$TOOLTIP_TEXT"
        PROCESSED["HID:${VP_UPPER}"]=1
    fi
done

# ==============================================================================
# 2. BLUETOOTH DEVICES (generic)
# ==============================================================================
BT_DEVICES=$(bluetoothctl devices Connected 2>/dev/null | awk '{print $2}')

for MAC in $BT_DEVICES; do
    [ "${PROCESSED[$MAC]}" = "1" ] && continue
    
    BT_INFO=$(bluetoothctl info "$MAC" 2>/dev/null)
    BT_NAME=$(echo "$BT_INFO" | grep "Name:" | cut -d':' -f2 | xargs)
    BT_ICON=$(echo "$BT_INFO" | grep "Icon:" | cut -d':' -f2 | xargs)
    BT_BATTERY=$(echo "$BT_INFO" | grep "Battery Percentage:" | grep -oP '\(\K[0-9]+(?=\))')
    
    case "$BT_ICON" in
        "audio-headset"|"audio-headphones"|"audio-card")
            EMOJI="🎧"; TYPE="Headset" ;;
        "input-gaming"|"input-gamepad")
            EMOJI="🎮"; TYPE="Gamepad" ;;
        "input-keyboard")
            EMOJI="⌨️"; TYPE="Keyboard" ;;
        "input-mouse")
            EMOJI="🖱️"; TYPE="Mouse" ;;
        *)
            EMOJI="❓"; TYPE="Unknown" ;;
    esac
    
    TOOLTIP_TEXT="$BT_NAME ($TYPE)\n"
    [ -n "$BT_BATTERY" ] && TOOLTIP_TEXT="${TOOLTIP_TEXT}Battery: ${BT_BATTERY}%\n"
    TOOLTIP_TEXT="${TOOLTIP_TEXT}MAC: $MAC"
    
    collect_device "$EMOJI" "$BT_BATTERY" "$TOOLTIP_TEXT"
    PROCESSED["BT:$MAC"]=1
done

# ==============================================================================
# 3. СПЕЦІАЛЬНІ ДРАЙВЕРИ (OpenRazer, etc)
# ==============================================================================

for MOUSE_PATH in /sys/bus/hid/drivers/razermouse/*/charge_level; do
    [ -f "$MOUSE_PATH" ] || continue
    
    MOUSE_DIR=$(dirname "$MOUSE_PATH")
    DEVICE_TYPE=$(cat "$MOUSE_DIR/device_type" 2>/dev/null)
    SERIAL=$(cat "$MOUSE_DIR/device_serial" 2>/dev/null || echo "N/A")
    CHARGE=$(cat "$MOUSE_DIR/charge_level")
    PCT=$((CHARGE * 100 / 255))
    
    [ "${PROCESSED[RAZER:$SERIAL]}" = "1" ] && continue
    
    TOOLTIP_TEXT="$DEVICE_TYPE\nBattery: ${PCT}%\nSerial: $SERIAL"
    collect_device "🖱️" "$PCT" "$TOOLTIP_TEXT"
    PROCESSED["RAZER:$SERIAL"]=1
    PROCESSED["RAZER_PRESENT"]=1
done

for KBD_PATH in /sys/bus/hid/drivers/razerkbd/*/charge_level; do
    [ -f "$KBD_PATH" ] || continue
    
    KBD_DIR=$(dirname "$KBD_PATH")
    DEVICE_TYPE=$(cat "$KBD_DIR/device_type" 2>/dev/null)
    SERIAL=$(cat "$KBD_DIR/device_serial" 2>/dev/null || echo "N/A")
    CHARGE=$(cat "$KBD_DIR/charge_level")
    PCT=$((CHARGE * 100 / 255))
    
    [ "${PROCESSED[RAZER:$SERIAL]}" = "1" ] && continue
    
    TOOLTIP_TEXT="$DEVICE_TYPE\nBattery: ${PCT}%\nSerial: $SERIAL"
    collect_device "⌨️" "$PCT" "$TOOLTIP_TEXT"
    PROCESSED["RAZER:$SERIAL"]=1
    PROCESSED["RAZER_PRESENT"]=1
done

# ==============================================================================
# 4. GENERIC HID FALLBACK (всі HID пристрої)
# ==============================================================================

for HID_DEVICE in /sys/bus/hid/devices/*; do
    [ -d "$HID_DEVICE" ] || continue
    
    HID_ID=$(basename "$HID_DEVICE")
    VENDOR_PRODUCT=$(echo "$HID_ID" | grep -oP '^\w+:\K[0-9A-F]{4}:[0-9A-F]{4}')
    
    [ -z "$VENDOR_PRODUCT" ] && continue
    [ "${PROCESSED[HID:$VENDOR_PRODUCT]}" = "1" ] && continue
    
    if [ -f "$HID_DEVICE/uevent" ]; then
        DEVICE_NAME=$(grep "HID_NAME=" "$HID_DEVICE/uevent" 2>/dev/null | cut -d'=' -f2-)
        [ -z "$DEVICE_NAME" ] && continue
        
        if echo "$DEVICE_NAME" | grep -qi "razer"; then
            [ "${PROCESSED[RAZER_PRESENT]}" = "1" ] && continue
        fi
        
        EMOJI="❓"
        TYPE="Unknown"
        
        if echo "$DEVICE_NAME" | grep -qi "microphone\|mic\|fifine"; then
            EMOJI="🎤"; TYPE="Microphone"
        elif echo "$DEVICE_NAME" | grep -qi "keyboard\|kbd"; then
            EMOJI="⌨️"; TYPE="Keyboard"
        elif echo "$DEVICE_NAME" | grep -qi "mouse\|mice"; then
            EMOJI="🖱️"; TYPE="Mouse"
        elif echo "$DEVICE_NAME" | grep -qi "gamepad\|controller\|xbox\|playstation"; then
            EMOJI="🎮"; TYPE="Gamepad"
        elif echo "$DEVICE_NAME" | grep -qi "headset\|headphone"; then
            EMOJI="🎧"; TYPE="Headset"
        fi
        
        if ls "$HID_DEVICE/input/"input*/event* &>/dev/null; then
            TOOLTIP_TEXT="$DEVICE_NAME ($TYPE)\nHID: $VENDOR_PRODUCT"
            collect_device "$EMOJI" "" "$TOOLTIP_TEXT"
            PROCESSED["HID:$VENDOR_PRODUCT"]=1
        fi
    fi
done

# ==============================================================================
# ФОРМУВАННЯ ФІНАЛЬНОГО ВИВОДУ (з батареєю першими)
# ==============================================================================

HTML=""
TOOLTIP=""

# Спочатку пристрої З батареєю
for device_data in "${DEVICES_WITH_BATTERY[@]}"; do
    IFS='|||' read -r device_html tooltip_text <<< "$device_data"
    
    [ -n "$HTML" ] && HTML="$HTML $SEP "
    HTML="$HTML$device_html"
    
    [ -n "$TOOLTIP" ] && TOOLTIP="$TOOLTIP\n\n"
    TOOLTIP="$TOOLTIP$tooltip_text"
done

# Потім пристрої БЕЗ батареї
for device_data in "${DEVICES_WITHOUT_BATTERY[@]}"; do
    IFS='|||' read -r device_html tooltip_text <<< "$device_data"
    
    [ -n "$HTML" ] && HTML="$HTML $SEP "
    HTML="$HTML$device_html"
    
    [ -n "$TOOLTIP" ] && TOOLTIP="$TOOLTIP\n\n"
    TOOLTIP="$TOOLTIP$tooltip_text"
done

# JSON output
if [ -n "$HTML" ]; then
    echo "{\"text\":\"$HTML\",\"tooltip\":\"$TOOLTIP\"}"
else
    echo ""
fi
