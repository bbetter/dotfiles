cd ~/.dotfiles || exit 1

if [[ -n $(git status --porcelain) ]]; then
    git add -A
    git commit -m "Auto backup: $(date +'%Y-%m-%d %H:%M')"
    echo "✅ Changes committed"
else
    echo "ℹ️  No changes to commit"
fi

