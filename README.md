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
| Launcher | **vicinae** (`SUPER+SPACE`); menus (theme, keybinds, clipboard, browser) use `ags-pick`, an AGS overlay (fuzzel is its fallback) |
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

## Session manager (`hypr-sm`)

Named window sessions for Hyprland: save what is open, restore it exactly (workspaces, floating windows,
tiled layouts, terminal directories, Chrome/Firefox tabs, IDE projects), and swap between setups.
`SUPER+N` opens the GUI (an AGS window: `ags/.config/ags/widget/Sessions.ts`); everything it does is also
a CLI command (`hypr-sm --help`).

- **Persistent** sessions are named by you and kept until deleted; **recent** ones (autosave, history,
  "Before ..." safety snapshots) are automatic. Replace has a preview and an Undo.
- Persistent sessions live in `~/.config/hypr-sm/sessions/` with a **local git history** (nothing is pushed);
  deleted ones can be restored from the GUI. They are deliberately not in this (public) repo.
- Optional `~/.config/hypr-sm/config.toml`: autosave interval, history length, login prompt, backup, launcher entries.
- Per-session hotkeys are generated into `~/.config/hypr-sm/binds.lua` (loaded from `binds.lua`); they only
  ever open/switch, never close windows. Each persistent session also gets a launcher entry.
- Tests (`tests/hypr-sm`, stdlib only): `python3 -m unittest discover -s tests/hypr-sm`; see its README for the
  opt-in live and GUI tests.

## Session services (systemd)

The long-running helpers are systemd user units instead of a pile of `exec_cmd`s,
so they restart on failure, log to the journal and start in order.
`hypr/.config/hypr/autostart.lua` hands the session environment to systemd and
(re)starts `hyprland-session.target`; the units live in `hypr/.config/hypr/systemd/`
(`install.sh` links them with `systemctl --user link`; they are not stowed because
`~/.config/systemd/user` also holds units that are not in this repo).

```bash
systemctl --user status hyprland-session.target 'hypr-*'
journalctl --user -u hypr-ags -f            # AGS output / crashes
systemctl --user restart hypr-ags           # after editing widgets
```

`swaync`, `hypridle` and `vicinae` use the distro-packaged units. `wall shuffle`
stays an `exec_cmd` (it manages its own daemon). No polkit agent is installed:
install one (e.g. `hyprpolkitagent`) and add it to autostart.

## Idle and sessions

`hypridle.conf` calls `lock.sh` / `before-sleep.sh`, which take a `hypr-sm autosave`
snapshot before locking or sleeping, so a shutdown while locked keeps the latest windows.

## Menus (`ags-pick`)

`ags-pick` is a dmenu replacement (lines on stdin, chosen line on stdout) that shows an
AGS overlay (`widget/Picker.ts`, styled from the wal palette) and falls back to fuzzel when
AGS is not running. Options: `-p PROMPT`, `--with-nth N`, `--index`; exit status 1 = cancelled.

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
