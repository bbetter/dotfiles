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

# --- Active connections ---
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

    # --- IP / Gateway ---
    dev_info = run(["nmcli", "-t", "device", "show", device])
    ip_addr = "N/A"
    gateway = "N/A"
    for dl in dev_info.splitlines():
        if dl.startswith("IP4.ADDRESS"):
            ip_addr = dl.split(":", 1)[1].split("/")[0]
        elif dl.startswith("IP4.GATEWAY"):
            val = dl.split(":", 1)[1].strip()
            if val:
                gateway = val

    if conn_type == "802-11-wireless":
        # --- Wi-Fi: SSID + signal ---
        ssid = "Unknown"
        signal = ""
        for wl in run(["nmcli", "-t", "-f", "ACTIVE,SSID,SIGNAL", "dev", "wifi"]).splitlines():
            if wl.startswith("yes:"):
                rest = wl[4:]
                # SIGNAL is the last numeric field
                rparts = rest.rsplit(":", 1)
                if len(rparts) == 2:
                    ssid = rparts[0].replace("\\:", ":")
                    signal = rparts[1]
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
