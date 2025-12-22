#!/bin/bash

cd ~/.dotfiles || exit 1

if [[ -n $(git status --porcelain) ]]; then
    git add -A
    git commit -m "Auto backup: $(date +'%Y-%m-%d %H:%M')"
    echo "✅ Changes committed"

    # PUSH
    git push origin main && echo "📤 Pushed to GitHub" || echo "❌ Push failed"
else
    echo "ℹ️  No changes to commit"
fi

