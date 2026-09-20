#!/bin/bash
# SUPER+`: toggle the sidebar; start AGS first (hypr-ags user unit) if it is not running.

UNIT=hypr-ags.service
RUNTIME_PATTERN='gjs -m /run/user/.*/ags\.js|ags run .*/\.config/ags'

if pgrep -f "$RUNTIME_PATTERN" > /dev/null; then
    ags request sidebar toggle >/dev/null 2>&1
else
    systemctl --user start "$UNIT"
    # Wait until the request handler answers instead of guessing a sleep.
    for _ in $(seq 1 50); do
        ags request sidebar open >/dev/null 2>&1 && break
        sleep 0.1
    done
fi
