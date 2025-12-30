#!/usr/bin/env python3
import subprocess
import json
import re
import sys

DEBUG = False  # True -> stderr logs

def debug(msg):
    if DEBUG:
        print(f"[network] {msg}", file=sys.stderr)

def run(cmd):
    try:
        return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
    except Exception:
        return ""

# ------------------------------------------------------------
# 1. Determine default route (active interface)
# ------------------------------------------------------------

route = run(["ip", "route", "show", "default"])
debug(f"default route:\n{route}")

if not route.strip():
    # No network
    print(json.dumps({
        "text": "🚫",
        "tooltip": "No network connection"
    }))
    sys.exit(0)

m = re.search(r"default via (\S+) dev (\S+)", route)
if not m:
    print(json.dumps({
        "text": "🚫",
        "tooltip": "No network connection"
    }))
    sys.exit(0)

gateway = m.group(1)
iface = m.group(2)

# ------------------------------------------------------------
# 2. Get IP address
# ------------------------------------------------------------

ip_info = run(["ip", "-4", "addr", "show", iface])
ip_match = re.search(r"inet (\d+\.\d+\.\d+\.\d+)", ip_info)
ip_addr = ip_match.group(1) if ip_match else "N/A"

# ------------------------------------------------------------
# 3. Check if Wi-Fi or Ethernet
# ------------------------------------------------------------

iw = run(["iw", "dev"])
is_wifi = iface in iw

if is_wifi:
    # ---------------- Wi-Fi ----------------
    link = run(["iw", "dev", iface, "link"])
    debug(f"iw link:\n{link}")

    ssid_match = re.search(r"SSID: (.+)", link)
    ssid = ssid_match.group(1) if ssid_match else "Unknown"

    text = f"📶 {ssid}"
    tooltip = (
        "Wi-Fi\n"
        f"SSID: {ssid}\n"
        f"Interface: {iface}\n"
        f"IP: {ip_addr}\n"
        f"Gateway: {gateway}"
    )

else:
    # ---------------- Ethernet ----------------
    text = "󰈀 LAN"
    tooltip = (
        "Ethernet\n"
        f"Interface: {iface}\n"
        f"IP: {ip_addr}\n"
        f"Gateway: {gateway}"
    )

# ------------------------------------------------------------
# OUTPUT
# ------------------------------------------------------------

print(json.dumps({
    "text": text,
    "tooltip": tooltip
}, ensure_ascii=False))