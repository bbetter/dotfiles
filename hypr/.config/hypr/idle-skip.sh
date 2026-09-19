#!/bin/sh
# Exit 0 (= skip the idle action) if the sidebar "Keep awake" guard file is
# set, or the currently focused window is fullscreen (games, mostly —
# controller-only play or a long cutscene means no mouse/kb activity for
# minutes at a time, but dbus idle-inhibit isn't sent reliably by every game).
# Any lookup failure (no focused window, hyprctl/jq hiccup) falls through to
# "don't skip" rather than accidentally blocking the lock forever.

[ -e "$XDG_RUNTIME_DIR/ags-keep-awake" ] && exit 0

fullscreen=$(hyprctl activewindow -j 2>/dev/null | jq -r '.fullscreen // 0' 2>/dev/null)
[ -n "$fullscreen" ] && [ "$fullscreen" != "0" ]
