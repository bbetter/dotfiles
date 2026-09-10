# dotfiles

Hyprland rice for Arch / EndeavourOS. Wallpaper-driven theming across the whole
desktop.

## Screenshots

<!-- add: ./assets/desktop.png, ./assets/sidebar.png, ./assets/theme-switch.gif -->
_TODO_

## Stack

| | |
|---|---|
| Compositor | **Hyprland** — native Lua config (`~/.config/hypr/*.lua`, no `hyprland.conf`) |
| Bar + sidebar | **AGS** (Aylur's GTK Shell / Astal, GTK4) |
| Launcher | **vicinae** (`SUPER+SPACE`); **fuzzel** for dmenu prompts |
| Terminal | **ghostty** |
| Notifications | **swaync** |
| Lock / idle | **hyprlock** + **hypridle** |
| Wallpapers | **[wall](https://github.com/bbetter/wall)** (linux-wallpaperengine manager) |
| Theme engine | **pywal** — palette from the current wallpaper, pushed to AGS, Hyprland borders, swaync, ghostty, fuzzel, hyprlock, fastfetch, GTK |
| Night light | **hyprsunset** |
| Screenshots | grim + slurp + **satty** |
| Cursor / font | rose-pine-hyprcursor · JetBrainsMono Nerd Font |
| Extras | cava, mpv, fastfetch |

## Theme pipeline

`wall` changes wallpaper → `theme-watcher.sh` notices → `apply-theme.sh` runs
`wal` → `gen-theme.sh` renders every `*.template.*` into the real config and
reloads the consumers live (no restarts). Mode lives in
`~/.config/theme/current_mode`:

- `dynamic` — one wallpaper mirrored across monitors, one palette
- `dynamic (per-monitor experimental)` — each monitor its own wallpaper, palette blended from all
- any wal theme name — static

Switch with `SUPER+F1`. The rendered outputs are git-ignored (regenerated on
every wallpaper change); only the `*.template.*` sources are tracked. Recreate
them with `~/.config/scripts/apply-theme.sh`.

## Layout

Stow packages, one per app:

```
hypr ags ghostty swaync swaylock cava mpv neofetch scripts
```

`scripts` also carries `~/.config/{scripts,theme,fastfetch}` and
`~/.local/bin` helpers.

## Install (configs only)

```bash
sudo pacman -S --needed stow
git clone https://github.com/bbetter/dotfiles ~/.dotfiles
cd ~/.dotfiles
stow -v hypr ags ghostty swaync swaylock cava mpv neofetch scripts
~/.config/scripts/apply-theme.sh   # seed the generated theme files
```

Then install the packages the stack needs (Hyprland, aylurs-gtk-shell,
vicinae, hyprlock, hypridle, hyprsunset, satty, python-pywal, imagemagick,
jq, socat, dart-sass, playerctl, …) and `npm install` inside `~/.config/ags`.

## Full machine provisioning

The one-command "fresh Arch → working rice" bootstrap (package sets,
services, secrets, host-specific config) lives in a separate private repo,
`bbetter/arch-setup`. This repo is just the configs.

## Auto-commit

`dotfiles-auto-commit.timer` (systemd user) commits changes daily at 23:00.
