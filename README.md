# 🏠 My Dotfiles

Personal dotfiles for EndeavourOS/Arch Linux + Hyprland setup

## 🎨 Rice Preview

- **WM**: Hyprland
- **Bar**: AGS  
- **Launcher**: Wofi
- **Terminal**: Ghostty
- **Notifications**: SwayNC
- **Lock Screen**: Swaylock
- **Extras**: Cava, MPV, Neofetch, MangoHud

## 🚀 Fresh Install (Clean Arch)
```bash
# 1. Clone dotfiles
git clone https://github.com/USERNAME/dotfiles.git ~/.dotfiles

# 2. Run install script (installs packages + stow configs)
cd ~/.dotfiles
./install.sh

# 3. Logout and login to Hyprland
```

## 🔧 Manual Setup

### Install packages:
```bash
# Official packages
sudo pacman -S --needed - < packages.txt

# AUR packages (requires yay)
yay -S --needed - < aur-packages.txt
```

### Link configs:
```bash
cd ~/.dotfiles
stow -v hypr ags wofi ghostty swaync swaylock cava neofetch mpv scripts
```

## 📦 Core Packages

### Window Manager:
- hyprland, aylurs-gtk-shell, wofi, swaync, swaylock

### Terminal & Shell:
- ghostty, zsh/bash

### Media:
- mpv, vlc, cava

### Gaming:
- mangohud, goverlay, vkbasalt

### System:
- btop, neofetch, thunar

## 🤖 Auto-Backup

Configs are auto-committed daily at 23:00 via systemd timer.

### Manual operations:
```bash
# Check status
cd ~/.dotfiles && git status

# Push to GitHub
cd ~/.dotfiles && git push

# View commit history
cd ~/.dotfiles && git log --oneline -10
```

## 📝 Adding New Configs
```bash
# 1. Create stow structure
mkdir -p ~/.dotfiles/newapp/.config/newapp

# 2. Copy config
cp ~/.config/newapp/* ~/.dotfiles/newapp/.config/newapp/

# 3. Backup original
cp -r ~/.config/newapp ~/config-backup/

# 4. Remove original
rm -rf ~/.config/newapp

# 5. Stow it
cd ~/.dotfiles
stow -v newapp

# 6. Commit
git add .
git commit -m "Add newapp config"
git push
```

## 🔄 Updating on Another Machine
```bash
cd ~/.dotfiles
git pull
stow -R */  # Restow all configs
```

## 📸 Screenshots

*TODO: Add screenshots*

## 📄 License

MIT
