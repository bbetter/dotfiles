#!/usr/bin/env bash
# Roll back monitors.lua / look.lua to a known-good tagged state and reload Hyprland.
# Usage: ./fallback.sh <tag>
#   e.g. ./fallback.sh hypr-baseline-2026-08-01
#        ./fallback.sh hypr-stage-a-165hz
#        ./fallback.sh hypr-stage-b-hdr
#
# Run with no args to list available stage tags.

set -euo pipefail
cd "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"

FILES=(hypr/.config/hypr/monitors.lua hypr/.config/hypr/look.lua)

if [ $# -eq 0 ]; then
    echo "Available fallback tags:"
    git tag -l "hypr-*"
    exit 1
fi

TAG="$1"
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "Tag '$TAG' not found. Available tags:"
    git tag -l "hypr-*"
    exit 1
fi

echo "Restoring ${FILES[*]} from $TAG..."
git checkout "$TAG" -- "${FILES[@]}"
echo "Reloading Hyprland..."
hyprctl reload
echo "Done. Now at: $(git log -1 --format='%h %s' -- "${FILES[@]}")"
echo "Note: this only restores files in the working tree; commit if you want to keep this rollback as history."
