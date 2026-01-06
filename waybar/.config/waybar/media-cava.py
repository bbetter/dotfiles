#!/usr/bin/env python3
import subprocess
import json
import sys
import os
import select

def cmd(args):
    """Execute command and return output"""
    try:
        return subprocess.check_output(
            args, stderr=subprocess.DEVNULL
        ).decode().strip()
    except:
        return None

def get_cava_bars():
    """Get a single frame from cava visualization"""
    try:
        # Start cava process
        proc = subprocess.Popen(
            ['cava', '-p', os.path.expanduser('~/.config/cava/config-waybar')],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL
        )

        # Read first line with timeout
        import select
        ready = select.select([proc.stdout], [], [], 0.3)
        if ready[0]:
            line = proc.stdout.readline().decode().strip()
            proc.terminate()
            proc.wait()

            line = line.replace(';', '')

            # Color bars based on height
            bars = []
            for char in line[:8]:  # Limit to 8 bars for compactness
                if char == '0':
                    bars.append("<span foreground='#6c7086'>▁</span>")
                elif char == '1':
                    bars.append("<span foreground='#89b4fa'>▂</span>")
                elif char == '2':
                    bars.append("<span foreground='#89dceb'>▃</span>")
                elif char == '3':
                    bars.append("<span foreground='#a6e3a1'>▄</span>")
                elif char == '4':
                    bars.append("<span foreground='#f9e2af'>▅</span>")
                elif char == '5':
                    bars.append("<span foreground='#fab387'>▆</span>")
                elif char == '6':
                    bars.append("<span foreground='#f5c2e7'>▇</span>")
                elif char == '7':
                    bars.append("<span foreground='#cba6f7'>█</span>")

            return " " + "".join(bars) if bars else ""
        else:
            proc.terminate()
            proc.wait()
            return ""
    except:
        return ""

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

# Status icon with visual indicator
if status == "Playing":
    icon = "♪"
    # Get cava bars only when playing
    cava_bars = get_cava_bars()
else:
    icon = "⏸"
    cava_bars = ""

# Build display text with timer and cava visualization
display_text = f"{icon} -{fmt_time(remaining)}{cava_bars}"

# Tooltip with full info
tooltip = f"{title}\n{artist}\nRemaining: {fmt_time(remaining)}"

print(json.dumps({
    "text": display_text,
    "tooltip": tooltip,
    "class": status.lower()
}))
