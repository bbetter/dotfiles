#!/usr/bin/env python3
import json
import subprocess
import sys

direction = sys.argv[1]  # left | right

# НАЛАШТУВАННЯ — під твій сетап
WORKSPACE_RANGES = {
    0: range(1, 6),    # monitor index 0 → 1..5
    1: range(6, 11),   # monitor index 1 → 6..10
}

def hypr(cmd):
    return json.loads(subprocess.check_output(["hyprctl", "-j"] + cmd))

monitors = hypr(["monitors"])
workspaces = hypr(["workspaces"])

active_monitor = next(m for m in monitors if m["focused"])
mon_idx = active_monitor["id"]
active_ws = active_monitor["activeWorkspace"]["id"]

my_range = WORKSPACE_RANGES.get(mon_idx)
if not my_range:
    sys.exit(0)

target = None

if direction == "left":
    if active_ws - 1 in my_range:
        target = active_ws - 1
    else:
        # переходимо на інший монітор
        for idx, r in WORKSPACE_RANGES.items():
            if idx != mon_idx and active_ws - 1 in r:
                target = active_ws - 1
                break

elif direction == "right":
    if active_ws + 1 in my_range:
        target = active_ws + 1
    else:
        for idx, r in WORKSPACE_RANGES.items():
            if idx != mon_idx and active_ws + 1 in r:
                target = active_ws + 1
                break

if target is not None:
    subprocess.run(["hyprctl", "dispatch", "workspace", str(target)])
 