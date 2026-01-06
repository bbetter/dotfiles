#!/bin/bash

get_window_title() {
    TITLE=$(hyprctl activewindow -j 2>/dev/null | jq -r '.title // ""')

    if [ -z "$TITLE" ]; then
        echo ""
        return
    fi

    # Apply rewrites
    case "$TITLE" in
        *" — Mozilla Firefox")
            TITLE="🌐 ${TITLE% — Mozilla Firefox}"
            ;;
        *" - Visual Studio Code")
            TITLE=" ${TITLE% - Visual Studio Code}"
            ;;
        *" - Thunar")
            TITLE=" ${TITLE% - Thunar}"
            ;;
        "kitty")
            TITLE=" Terminal"
            ;;
    esac

    # Truncate to max 50 characters
    if [ ${#TITLE} -gt 50 ]; then
        TITLE="${TITLE:0:47}..."
    fi

    echo "$TITLE"
}

# Continuous polling mode
while true; do
    get_window_title
    sleep 0.5
done
