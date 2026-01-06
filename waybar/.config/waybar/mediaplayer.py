#!/usr/bin/env python3
import subprocess
import json
import os

STATE_FILE = "/tmp/waybar-mediaplayer-trackid"

def cmd(args):
    return subprocess.check_output(
        args, stderr=subprocess.DEVNULL
    ).decode().strip()

def no_media():
    print(json.dumps({
        "text": "",
        "class": "no-media"
    }))
    exit(0)

# ---- status ----
try:
    status = cmd(["playerctl", "status"])
except:
    no_media()

if status not in ("Playing", "Paused"):
    no_media()

# ---- track id ----
try:
    track_id = cmd(["playerctl", "metadata", "mpris:trackid"])
except:
    no_media()

# ---- detect track change ----
last_track_id = None
if os.path.exists(STATE_FILE):
    with open(STATE_FILE, "r") as f:
        last_track_id = f.read().strip()

track_changed = track_id != last_track_id

with open(STATE_FILE, "w") as f:
    f.write(track_id)

# ---- position / length ----
try:
    pos = float(cmd(["playerctl", "position"]))
    length_us = int(cmd(["playerctl", "metadata", "mpris:length"]))
except:
    no_media()

length = length_us / 1_000_000

# якщо трек щойно змінився — не довіряємо старому position
if track_changed or pos < 0 or pos > length:
    pos = 0.0

def fmt(t):
    t = int(t)
    h = t // 3600
    m = (t % 3600) // 60
    s = t % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

icon = "⏸" if status == "Paused" else "▶"

# ---- tooltip ----
try:
    tooltip = cmd([
        "playerctl", "metadata",
        "--format", "{{title}}\n{{artist}}"
    ])
except:
    tooltip = ""

print(json.dumps({
    "text": f"{icon} {fmt(pos)} / {fmt(length)}",
    "tooltip": tooltip,
    "class": status.lower()
}))

