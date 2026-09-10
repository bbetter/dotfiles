#!/bin/bash
# Link the config packages into place. "Configs only" — does NOT install
# packages or set up services. For the full fresh-machine bootstrap see the
# private `bbetter/arch-setup` repo.
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DOTFILES_DIR"

PACKAGES=(hypr ags ghostty swaync swaylock cava mpv neofetch scripts)

command -v stow >/dev/null || { echo "need stow: sudo pacman -S --needed stow" >&2; exit 1; }

# Move aside whole real (non-symlink) target dirs stow would collide with,
# e.g. ~/.config/hypr shipped by the distro.
BACKUP="$HOME/config-backup-$(date +%F_%H-%M-%S)"
for p in "${PACKAGES[@]}"; do
  for d in "$p"/.config/*/ "$p"/.local/*/; do
    [ -d "$d" ] || continue
    t="$HOME/${d#"$p"/}"
    if [ -e "$t" ] && [ ! -L "$t" ]; then
      mkdir -p "$BACKUP/$(dirname "${t#"$HOME"/}")"
      echo "backup: $t"
      mv "$t" "$BACKUP/${t#"$HOME"/}"
    fi
  done
done
[ -d "$BACKUP" ] && echo "pre-existing configs moved to $BACKUP"

echo "stowing: ${PACKAGES[*]}"
stow -v -R "${PACKAGES[@]}"

if command -v wal >/dev/null; then
  echo "seeding generated theme files..."
  "$HOME/.config/scripts/apply-theme.sh" || true
else
  echo "note: install pywal, then run ~/.config/scripts/apply-theme.sh"
fi

echo "done — log out / back in to Hyprland."
