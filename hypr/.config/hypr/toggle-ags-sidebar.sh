#!/bin/bash

APP_DIR="$HOME/.config/ags"
RUNTIME_PATTERN='gjs -m /run/user/.*/ags\.js|ags run .*/\.config/ags'

if pgrep -f "$RUNTIME_PATTERN" > /dev/null; then
    ags request sidebar toggle >/dev/null 2>&1
else
    ags run "$APP_DIR" >/dev/null 2>&1 &
    sleep 1
    ags request sidebar open >/dev/null 2>&1
fi
