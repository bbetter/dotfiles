#!/usr/bin/env python3
import subprocess
import json
import sys

def cmd(args):
    """Execute command and return output"""
    try:
        return subprocess.check_output(
            args, stderr=subprocess.DEVNULL
        ).decode().strip()
    except:
        return None

def no_media():
    """Return empty state when no media is playing"""
    print(json.dumps({
        "text": "",
        "class": "no-media"
    }))
    sys.exit(0)

# Check player status
status = cmd(["playerctl", "status"])
if not status or status not in ("Playing", "Paused"):
    no_media()

# Get track metadata
try:
    artist = cmd(["playerctl", "metadata", "artist"]) or "Unknown"
    title = cmd(["playerctl", "metadata", "title"]) or "Unknown"
    pos = float(cmd(["playerctl", "position"]) or "0")
    length_us = int(cmd(["playerctl", "metadata", "mpris:length"]) or "0")
except:
    no_media()

length = length_us / 1_000_000

# Calculate remaining time (countdown)
remaining = max(0, length - pos)

def fmt_time(seconds):
    """Format seconds as M:SS (countdown format)"""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"

# Status icon
if status == "Playing":
    icon = "♪"
else:
    icon = "⏸"

# Build display text - just timer
display_text = f"{icon} -{fmt_time(remaining)}"

# Tooltip with full info
tooltip = f"{title}\n{artist}\nRemaining: {fmt_time(remaining)}"

print(json.dumps({
    "text": display_text,
    "tooltip": tooltip,
    "class": status.lower()
}))
