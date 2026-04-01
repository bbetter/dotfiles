#!/usr/bin/env python3
import subprocess
import json
import os
import sys

SKIP_TYPES = {"loopback", "bridge", "tun"}


def run(cmd):
    try:
        env = {**os.environ, "LANG": "C"}
        return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL, env=env)
    except Exception:
        return ""


def no_network():
    print(json.dumps({"text": "🚫", "tooltip": "No network connection"}))
    sys.exit(0)


lines = run(["nmcli", "-t", "-f", "TYPE,NAME,DEVICE", "connection", "show", "--active"]).strip().splitlines()

for line in lines:
    parts = line.split(":")
    if len(parts) < 3:
        continue
    conn_type = parts[0]
    device = parts[-1]

    if conn_type in SKIP_TYPES:
        continue
    if conn_type not in ("802-11-wireless", "802-3-ethernet"):
        continue

    dev_info = run(["nmcli", "-t", "device", "show", device])
    ip_addr = "N/A"
    gateway = "N/A"
    for dev_line in dev_info.splitlines():
        if dev_line.startswith("IP4.ADDRESS"):
            ip_addr = dev_line.split(":", 1)[1].split("/")[0]
        elif dev_line.startswith("IP4.GATEWAY"):
            value = dev_line.split(":", 1)[1].strip()
            if value:
                gateway = value

    if conn_type == "802-11-wireless":
        ssid = "Unknown"
        signal = ""
        for wifi_line in run(["nmcli", "-t", "-f", "ACTIVE,SSID,SIGNAL", "dev", "wifi"]).splitlines():
            if wifi_line.startswith("yes:"):
                rest = wifi_line[4:]
                wifi_parts = rest.rsplit(":", 1)
                if len(wifi_parts) == 2:
                    ssid = wifi_parts[0].replace("\\:", ":")
                    signal = wifi_parts[1]
                break

        text = f"📶 {ssid}"
        tooltip = (
            f"Wi-Fi\n"
            f"SSID: {ssid}\n"
            f"Signal: {signal}%\n"
            f"Interface: {device}\n"
            f"IP: {ip_addr}\n"
            f"Gateway: {gateway}"
        )
    else:
        text = "󰈀 LAN"
        tooltip = (
            f"Ethernet\n"
            f"Interface: {device}\n"
            f"IP: {ip_addr}\n"
            f"Gateway: {gateway}"
        )

    print(json.dumps({"text": text, "tooltip": tooltip}, ensure_ascii=False))
    sys.exit(0)

no_network()
