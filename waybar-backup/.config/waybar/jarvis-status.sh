#!/bin/bash
# Waybar module for Jarvis status
cat /tmp/jarvis-status.json 2>/dev/null || echo '{"text": "", "tooltip": "Jarvis not running", "class": "offline"}'
