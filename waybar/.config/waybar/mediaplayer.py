#!/usr/bin/env python3
import sys
import json
import subprocess

try:
    # Get player status
    player = subprocess.run(
        ['playerctl', '-a', 'metadata', '--format', '{{playerName}}'],
        capture_output=True,
        text=True
    ).stdout.strip().split('\n')[0]
    
    status = subprocess.run(
        ['playerctl', 'status'],
        capture_output=True,
        text=True
    ).stdout.strip()
    
    artist = subprocess.run(
        ['playerctl', 'metadata', 'artist'],
        capture_output=True,
        text=True
    ).stdout.strip()
    
    title = subprocess.run(
        ['playerctl', 'metadata', 'title'],
        capture_output=True,
        text=True
    ).stdout.strip()
    
    if status == "Playing":
        text = f"{artist} - {title}" if artist else title
        output = {
            "text": text[:40],
            "tooltip": f"{player}: {artist} - {title}",
            "alt": player.lower(),
            "class": "playing"
        }
    else:
        output = {
            "text": "",
            "tooltip": "No media playing",
            "class": "paused"
        }
    
    print(json.dumps(output))
    
except Exception as e:
    print(json.dumps({"text": "", "class": "stopped"}))
