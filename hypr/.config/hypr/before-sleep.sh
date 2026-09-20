#!/bin/sh
# hypridle before_sleep_cmd: the machine may not wake up cleanly, so snapshot
# the windows first (synchronously, capped at 5 s: hypridle holds the sleep
# inhibitor until this returns), then lock.
timeout 5 "$HOME/.local/bin/hypr-sm" autosave >/dev/null 2>&1
loginctl lock-session
