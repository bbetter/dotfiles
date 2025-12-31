#!/bin/bash

set -e

# Визначаємо стан
ETH=$(nmcli -t -f DEVICE,TYPE,STATE device | grep ethernet | grep connected | cut -d: -f1)
WIFI_DEV=$(nmcli -t -f DEVICE,TYPE device | grep wifi | cut -d: -f1)
WIFI_CONN=$(nmcli -t -f ACTIVE,SSID dev wifi | grep '^yes' | cut -d: -f2)

MENU=""

if [ -n "$ETH" ]; then
    MENU+="🔌 LAN connected ($ETH)\n"
fi

if [ -n "$WIFI_CONN" ]; then
    MENU+="📶 Wi-Fi: $WIFI_CONN\n"
    MENU+="📴 Disconnect Wi-Fi\n"
else
    MENU+="📡 Connect Wi-Fi\n"
fi

MENU+="🔁 Restart NetworkManager\n"
MENU+="⬅ Back"

CHOICE=$(echo -e "$MENU" | wofi --dmenu --prompt "Network")

case "$CHOICE" in
    "📡 Connect Wi-Fi")
        nmcli dev wifi list | awk '{print $1}' | tail -n +2 \
          | wofi --dmenu --prompt "Select Wi-Fi" \
          | xargs -r nmcli dev wifi connect
        ;;
    "📴 Disconnect Wi-Fi")
        nmcli con down id "$WIFI_CONN"
        ;;
    "🔁 Restart NetworkManager")
        systemctl restart NetworkManager
        ;;
esac
