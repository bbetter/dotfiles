#!/usr/bin/env python3
import subprocess
import json
import sys
import os
import signal

def cmd(args):
    """Execute command and return output"""
    try:
        return subprocess.check_output(
            args, stderr=subprocess.DEVNULL, timeout=0.5
        ).decode().strip()
    except:
        return None

def get_media_info():
    """Get current media playback info"""
    status = cmd(["playerctl", "status"])
    if not status or status not in ("Playing", "Paused"):
        return None, None, None

    try:
        artist = cmd(["playerctl", "metadata", "artist"]) or "Unknown"
        title = cmd(["playerctl", "metadata", "title"]) or "Unknown"
        pos = float(cmd(["playerctl", "position"]) or "0")
        length_us = int(cmd(["playerctl", "metadata", "mpris:length"]) or "0")
        length = length_us / 1_000_000
        remaining = max(0, length - pos)

        mins = int(remaining // 60)
        secs = int(remaining % 60)
        time_str = f"{mins}:{secs:02d}"

        icon = "♪" if status == "Playing" else "⏸"
        tooltip = f"{title}\n{artist}\nRemaining: {time_str}"

        return icon, time_str, tooltip, status
    except:
        return None, None, None, None

def format_cava_line(line):
    """Convert cava output to colored bars"""
    line = line.replace(';', '')
    bars = []

    for char in line[:8]:  # Limit to 8 bars
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

    return "".join(bars)

def output_json(text, tooltip, css_class):
    """Output JSON for waybar"""
    print(json.dumps({
        "text": text,
        "tooltip": tooltip,
        "class": css_class
    }), flush=True)

# Handle cleanup on exit
def signal_handler(sig, frame):
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# Start cava process
cava_proc = subprocess.Popen(
    ['cava', '-p', os.path.expanduser('~/.config/cava/config-waybar')],
    stdout=subprocess.PIPE,
    stderr=subprocess.DEVNULL,
    text=True,
    bufsize=1
)

try:
    # Stream cava output
    for line in cava_proc.stdout:
        line = line.strip()
        if not line:
            continue

        # Get current media info
        result = get_media_info()

        if result[0] is None:
            # No media playing
            output_json("", "", "no-media")
            continue

        icon, time_str, tooltip, status = result

        # Format cava visualization
        cava_bars = format_cava_line(line)

        # Combine timer and visualization
        if status == "Playing" and cava_bars:
            display_text = f"{icon} -{time_str} {cava_bars}"
        else:
            display_text = f"{icon} -{time_str}"

        # Output to waybar
        output_json(display_text, tooltip, status.lower())

except (KeyboardInterrupt, BrokenPipeError):
    pass
finally:
    cava_proc.terminate()
    cava_proc.wait()
