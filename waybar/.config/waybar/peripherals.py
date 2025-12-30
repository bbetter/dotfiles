#!/usr/bin/env python3
import subprocess
import json
import re
import sys
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================

DEBUG = False   # True -> stderr debug

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

# ============================================================
# HELPERS
# ============================================================

def debug(msg):
    if DEBUG:
        print(f"[peripherals] {msg}", file=sys.stderr)

def run(cmd):
    try:
        return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
    except Exception as e:
        debug(f"cmd failed: {cmd} ({e})")
        return ""

def register(dev_type, priority, html, tooltip):
    cur = best.get(dev_type)
    if cur is None or priority > cur[0]:
        best[dev_type] = (priority, html, tooltip)
        debug(f"REGISTER {dev_type} prio={priority}")

# ============================================================
# 1. BLUETOOTH HEADSET (BATTERY FROM ACTIVE DEVICE)
# ============================================================

bt_info = run(["bluetoothctl", "info"])

bt_name = None
bt_battery = None
bt_found = False

if "Connected: yes" in bt_info and "Audio Sink" in bt_info:
    name_match = re.search(r"Name:\s*(.+)", bt_info)
    if name_match:
        bt_name = name_match.group(1)

    for pat in (
        r"Battery Percentage:.*\((\d+)\)",
        r"Battery Percentage:\s*(\d+)",
        r"Battery:\s*(\d+)%"
    ):
        m = re.search(pat, bt_info)
        if m:
            bt_battery = int(m.group(1))
            break

    bt_found = True
    debug(f"BT active headset: {bt_name}, battery={bt_battery}")


# ============================================================
# 2. PIPEWIRE AUDIO (CODEC + FALLBACK BATTERY)
# ============================================================

pactl = run(["pactl", "list", "sinks"])

for block in pactl.split("Sink #"):
    if "bluez_output" not in block:
        continue

    name_match = re.search(r'device.description = "(.+)"', block)
    if not name_match:
        continue

    name = name_match.group(1)

    # Codec parsing — ALL variants PipeWire uses
    codec = None
    for pat in (
        r'bluez.codec = "(.+)"',
        r'api.bluez5.codec = "(.+)"',
    ):
        m = re.search(pat, block)
        if m:
            codec = m.group(1)
            break

    # PipeWire battery fallback
    battery_pw = None
    m = re.search(r'device.battery.level = "([\d.]+)"', block)
    if m:
        battery_pw = int(float(m.group(1)) * 100)

    battery = bt_battery if bt_found and bt_battery is not None else battery_pw

    html = f"{DISPLAY['Headset']} {battery}%" if battery is not None else DISPLAY["Headset"]

    tooltip = f"{name} (Headset)"
    if battery is not None:
        tooltip += f"\nBattery: {battery}%"
    if codec:
        tooltip += f"\nCodec: {codec.upper()}"

    register("Headset", 120 if bt_found else 110, html, tooltip)

# ============================================================
# 3. RAZER DEVICES (BATTERY)
# ============================================================

# Mouse
for p in Path("/sys/bus/hid/drivers/razermouse").glob("*/charge_level"):
    try:
        pct = int(p.read_text().strip()) * 100 // 255
    except Exception:
        continue

    name = "Razer Mouse"
    if (p.parent / "device_type").exists():
        name = (p.parent / "device_type").read_text().strip()

    register(
        "Mouse",
        90,
        f"{DISPLAY['Mouse']} {pct}%",
        f"{name} (Mouse)\nBattery: {pct}%"
    )

# Keyboard
for p in Path("/sys/bus/hid/drivers/razerkbd").glob("*/charge_level"):
    try:
        pct = int(p.read_text().strip()) * 100 // 255
    except Exception:
        continue

    name = "Razer Keyboard"
    if (p.parent / "device_type").exists():
        name = (p.parent / "device_type").read_text().strip()

    register(
        "Keyboard",
        90,
        f"{DISPLAY['Keyboard']} {pct}%",
        f"{name} (Keyboard)\nBattery: {pct}%"
    )

# ============================================================
# 4. USB GAMEPAD (XPAD)
# ============================================================

for dev in Path("/sys/class/input").glob("event*/device/name"):
    try:
        name = dev.read_text().strip()
    except Exception:
        continue

    if re.search(r"x-?box", name, re.I):
        register(
            "Gamepad",
            80,
            DISPLAY["Gamepad"],
            f"{name} (USB)"
        )
        break

# ============================================================
# 5. GENERIC KEYBOARD / MOUSE (HID FALLBACK)
# ============================================================

if "Keyboard" not in best:
    for p in Path("/dev/input/by-id").glob("*kbd*"):
        if p.exists():
            register(
                "Keyboard",
                60,
                DISPLAY["Keyboard"],
                "Keyboard (USB / 2.4 GHz)"
            )
            break

if "Mouse" not in best:
    for p in Path("/dev/input/by-id").glob("*mouse*"):
        if p.exists():
            register(
                "Mouse",
                60,
                DISPLAY["Mouse"],
                "Mouse (USB / 2.4 GHz)"
            )
            break

# ============================================================
# 6. USB STORAGE
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
