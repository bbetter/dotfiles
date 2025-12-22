#!/bin/bash

set -e  # Вийти при помилці

DOTFILES_DIR="$HOME/.dotfiles"

echo "🚀 Installing dotfiles and packages..."

# Перевірка що запущено на Arch
if ! command -v pacman &> /dev/null; then
    echo "❌ This script is for Arch Linux only"
    exit 1
fi

# 1. Встановити stow якщо нема
if ! command -v stow &> /dev/null; then
    echo "📦 Installing stow..."
    sudo pacman -S --needed stow
fi

# 2. Встановити yay якщо нема (AUR helper)
if ! command -v yay &> /dev/null; then
    echo "📦 Installing yay..."
    sudo pacman -S --needed git base-devel
    cd /tmp
    git clone https://aur.archlinux.org/yay.git
    cd yay
    makepkg -si --noconfirm
    cd "$DOTFILES_DIR"
fi

# 3. Встановити офіційні пакети
if [ -f "$DOTFILES_DIR/packages.txt" ]; then
    echo "📦 Installing official packages..."
    sudo pacman -S --needed - < "$DOTFILES_DIR/packages.txt"
fi

# 4. Встановити AUR пакети
if [ -f "$DOTFILES_DIR/aur-packages.txt" ]; then
    echo "📦 Installing AUR packages..."
    yay -S --needed - < "$DOTFILES_DIR/aur-packages.txt"
fi

# 5. Stow конфіги
echo "🔗 Creating symlinks..."
cd "$DOTFILES_DIR"

# Backup існуючих конфігів (якщо є)
BACKUP_DIR="$HOME/config-backup-$(date +%Y-%m-%d_%H-%M-%S)"
for dir in hypr waybar wofi ghostty swaync swaylock cava neofetch mpv; do
    if [ -e "$HOME/.config/$dir" ] && [ ! -L "$HOME/.config/$dir" ]; then
        echo "📦 Backing up existing $dir config..."
        mkdir -p "$BACKUP_DIR"
        mv "$HOME/.config/$dir" "$BACKUP_DIR/"
    fi
done

# Stow всі конфіги
stow -v hypr waybar wofi ghostty swaync swaylock cava neofetch mpv scripts 2>/dev/null || true

# 6. Налаштувати systemd timer для auto-commit
echo "⏰ Setting up auto-commit timer..."
systemctl --user daemon-reload
systemctl --user enable --now dotfiles-auto-commit.timer

echo ""
echo "✅ Installation complete!"
echo ""
echo "📝 Next steps:"
echo "1. Logout and login to Hyprland"
echo "2. Configure monitors in ~/.config/hypr/hyprland.conf if needed"
echo "3. Check that everything works"
echo ""
echo "🎨 To customize:"
echo "   - Edit configs in ~/.dotfiles/"
echo "   - Changes will be auto-committed daily at 23:00"
echo "   - Manual push: cd ~/.dotfiles && git push"
