#!/usr/bin/env python3
import subprocess
import json
import re
from pathlib import Path

SEP = "<span foreground='#6c7086'>│</span>"

DISPLAY = {
    "Keyboard": "⌨️",
    "Mouse":    "🖱️",
    "Headset":  "🎧",
    "Gamepad":  "🎮",
    "Storage":  "💾",
}

# dev_type -> (priority, html, tooltip)
best = {}

def run(cmd):
    try:
        return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
    except Exception:
        return ""

def register(dev_type, priority, html, tooltip):
    cur = best.get(dev_type)
    if cur is None or priority > cur[0]:
        best[dev_type] = (priority, html, tooltip)

# ============================================================
# 1. BLUETOOTH (максимальний пріоритет)
# ============================================================

bt_lines = run(["bluetoothctl", "devices", "Connected"]).splitlines()

for line in bt_lines:
    parts = line.split(" ", 2)
    if len(parts) < 3:
        continue

    mac, name = parts[1], parts[2]
    info = run(["bluetoothctl", "info", mac])
    if "Connected: yes" not in info:
        continue

    icon = re.search(r"Icon:\s*(.+)", info)
    battery = re.search(r"Battery Percentage:.*\((\d+)\)", info)
    icon = icon.group(1) if icon else ""
    battery = battery.group(1) if battery else None

    if icon == "input-keyboard":
        dev_type = "Keyboard"
    elif icon == "input-mouse":
        dev_type = "Mouse"
    elif icon in ("audio-headset", "audio-headphones"):
        dev_type = "Headset"
    elif icon in ("input-gaming", "input-gamepad"):
        dev_type = "Gamepad"
    else:
        continue

    emoji = DISPLAY[dev_type]
    html = f"{emoji} {battery}%" if battery else emoji
    tooltip = f"{name} ({dev_type})"
    if battery:
        tooltip += f"\nBattery: {battery}%"

    register(dev_type, 100, html, tooltip)

# ============================================================
# 2. RAZER DRIVERS (mouse / keyboard, авторитетні)
# ============================================================

# Razer mouse
for p in Path("/sys/bus/hid/drivers/razermouse").glob("*/charge_level"):
    try:
        raw = int(p.read_text().strip())
        pct = raw * 100 // 255
    except Exception:
        continue

    dev_dir = p.parent
    name = "Razer Mouse"
    if (dev_dir / "device_type").exists():
        name = (dev_dir / "device_type").read_text().strip()

    register(
        "Mouse",
        90,
        f"{DISPLAY['Mouse']} {pct}%",
        f"{name} (Mouse)\nBattery: {pct}%"
    )

# Razer keyboard
for p in Path("/sys/bus/hid/drivers/razerkbd").glob("*/charge_level"):
    try:
        raw = int(p.read_text().strip())
        pct = raw * 100 // 255
    except Exception:
        continue

    dev_dir = p.parent
    name = "Razer Keyboard"
    if (dev_dir / "device_type").exists():
        name = (dev_dir / "device_type").read_text().strip()

    register(
        "Keyboard",
        90,
        f"{DISPLAY['Keyboard']} {pct}%",
        f"{name} (Keyboard)\nBattery: {pct}%"
    )

# ============================================================
# 3. KEYBOARD via evdev (2.4GHz dongle — ГОЛОВНЕ)
# ============================================================

if "Keyboard" not in best:
    for p in Path("/dev/input/by-id").glob("*kbd*"):
        if p.exists():
            register(
                "Keyboard",
                60,
                DISPLAY["Keyboard"],
                "Keyboard (USB / 2.4 GHz dongle)"
            )
            break

# ============================================================
# 4. MOUSE via evdev (на всякий випадок)
# ============================================================

if "Mouse" not in best:
    for p in Path("/dev/input/by-id").glob("*mouse*"):
        if p.exists():
            register(
                "Mouse",
                60,
                DISPLAY["Mouse"],
                "Mouse (USB / 2.4 GHz dongle)"
            )
            break

# ============================================================
# 5. USB STORAGE (флешки)
# ============================================================

try:
    lsblk = json.loads(run(["lsblk", "-o", "NAME,RM,MOUNTPOINT", "-J"]))
    for dev in lsblk.get("blockdevices", []):
        if dev.get("rm") and dev.get("mountpoint"):
            register(
                "Storage",
                70,
                DISPLAY["Storage"],
                f"USB Storage\nMounted at {dev['mountpoint']}"
            )
except Exception:
    pass

# ============================================================
# OUTPUT
# ============================================================

order = ["Keyboard", "Mouse", "Headset", "Gamepad", "Storage"]
html = []
tooltip = []

for dev_type in order:
    if dev_type in best:
        _, h, t = best[dev_type]
        html.append(h)
        tooltip.append(t)

if html:
    print(json.dumps({
        "text": f" {SEP} ".join(html),
        "tooltip": "\n\n".join(tooltip)
    }, ensure_ascii=False))
