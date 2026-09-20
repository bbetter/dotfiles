#!/bin/bash
# SUPER+W: stop AGS if it is running, start it otherwise. AGS is the hypr-ags
# user unit (see autostart.lua); a hand-started instance is handled as before.

UNIT=hypr-ags.service
RUNTIME_PATTERN='gjs -m /run/user/.*/ags\.js|ags run .*/\.config/ags'

if systemctl --user is-active --quiet "$UNIT"; then
    systemctl --user stop "$UNIT"
elif pgrep -f "$RUNTIME_PATTERN" > /dev/null; then
    pkill -f "$RUNTIME_PATTERN"
else
    systemctl --user start "$UNIT"
fi
