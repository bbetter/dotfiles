#!/bin/sh
# SUPER+V: pick from the clipboard history (cliphist) and put the choice back on the
# clipboard. cliphist lines are "id<TAB>preview"; the picker shows only the preview.
# Cancelling must not touch the clipboard, hence no bare `| wl-copy` pipeline.
choice=$(cliphist list | ags-pick -p Clipboard --with-nth 2) || exit 0
printf '%s' "$choice" | cliphist decode | wl-copy
