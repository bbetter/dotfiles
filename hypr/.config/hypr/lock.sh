#!/bin/sh
# hypridle lock_cmd: snapshot the windows, then lock.
# The snapshot runs in the background so it never delays the lock screen. It
# refreshes hypr-sm's rolling "Last session", so a shutdown while locked (or a
# crash on resume) loses nothing.
pidof hyprlock >/dev/null && exit 0
"$HOME/.local/bin/hypr-sm" autosave >/dev/null 2>&1 &
exec hyprlock
