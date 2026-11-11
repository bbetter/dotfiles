# Desktop setup: Hyprland + AGS (Arch, main PC)

Overview of how the desktop is put together, so changes can be made without
rediscovering it. Facts below were checked against the files in `~/.dotfiles`
on 2026-11-09. Anything marked **unverified** was not re-checked.

## Stack

| Piece | What it is | Where it lives |
|---|---|---|
| Compositor | Hyprland 0.57, native **Lua** config (no `hyprland.conf`). Version checked 2026-11-09 (`hyprctl version`: 0.57.0; 0.57.1 is pending in pacman). | `hypr/.config/hypr/*.lua`, entry `hyprland.lua` |
| Top bar, sidebar, popups | AGS (Astal, GTK4, TypeScript/TSX; `package.json` pins `"ags": "*"`, so the version is not fixed). Runs as a systemd user unit. | `ags/.config/ags/` (`app.ts`, `widget/`) |
| Notifications | swaync | `swaync/` |
| Launcher | vicinae (`SUPER+SPACE`) | autostart in `autostart.lua` |
| Idle / lock | hypridle, hyprlock (rendered from `hyprlock.template.conf`) | `hypr/.config/hypr/hypridle.conf`, `hyprlock.template.conf` |
| Wallpapers and theme | `wall` (own daemon, wallpaper engines). Colours come from the theme pipeline into `~/.config/theme/hyprland-colors.lua`. | source repo `~/workspace/MyScripts/wall`, theme template in `scripts/.config/theme/` |
| Session manager | `hypr-sm` (saved sessions), GUI is an AGS window | `~/.config/hypr-sm/` (not in dotfiles) |
| Login | ly | `ly/` |
| Terminal | ghostty | `ghostty/` |
| Other | cava, mpv, neofetch, swaylock | their own packages |

Dotfiles are a **stow** repo. `~/.config/hypr` is a symlink into `~/.dotfiles/hypr/.config/hypr`,
so editing either path edits the same file. A systemd timer (`dotfiles-auto-commit.timer`,
23:00 daily) commits the working tree.

## Startup

`hyprland.lua` loads, in order: `env`, `autostart`, `monitors`, `workspaces`, `look`,
`plugins`, `input`, `windows`, `binds`.

`autostart.lua` hands the session environment to systemd and D-Bus, then restarts
`hyprland-session.target`, `swaync`, `hypridle`, `vicinae` and `hyprpolkitagent`. It also runs
`wall shuffle 900` directly (not as a unit, on purpose: `wall` manages its own daemon).

Our own services are user units in `hypr/.config/hypr/systemd/`, linked by install.sh:

- `hypr-ags.service`: the AGS shell (bar, sidebar, popups)
- `hypr-sm-autosave.service`, `hypr-snappy.service`, `hypr-sunset.service`,
  `hypr-theme-watcher.service`, `hypr-fs-dnd.service`, `hypr-cliphist-*.service`,
  `hypr-ram-watchdog.service`

Useful commands:

```bash
systemctl --user status hyprland-session.target 'hypr-*'
systemctl --user restart hypr-ags        # after editing AGS widgets
journalctl --user -u 'hypr-*' -b
hyprctl reload && hyprctl configerrors   # apply Lua changes; empty output = OK
```

## AGS shell

- One set of windows per monitor, created in `app.ts` (`initWindows`) and re-created on hot-plug.
  Window ids include the connector name, e.g. `bar-DP-2`. Details: `ags/.config/ags/GEMINI.md`.
- The bar (`widget/Bar.tsx`) has: workspaces, window title, recording indicator, audio,
  network, bluetooth, language, Thunderbird unread, clock, sidebar toggle, and the Toolbox tray button.
- **Tray: only JetBrains Toolbox is shown** (`widget/bar/Tray.tsx`). AGS owns the StatusNotifier
  watcher (`org.kde.StatusNotifierWatcher`) and hosts items through `AstalTray`. The widget sits
  between the recording indicator and the sidebar toggle. It filters items by id (`/jetbrains/i`).
  Left click calls the item's `Activate` (Toolbox toggles its window). Right click opens the item's
  own DBusMenu. Other tray apps are not shown; widen `WANTED` to add them.
  Toolbox registers its item only when the watcher exists, so **after restarting `hypr-ags`,
  restart Toolbox too** (its item is not re-registered otherwise).
- Sidebar (`widget/Sidebar.tsx`, `widget/sidebar/*`): toggles, media, notifications,
  peripherals, updates, AI usage, system usage, power row.
- Session manager window: `ags request sessions toggle`, falls back to `hypr-sm menu` (fuzzel).

## Keybinds that matter (`binds.lua`)

| Keys | Action |
|---|---|
| `SUPER+W` | toggle AGS (`~/.config/hypr/toggle-ags.sh`) |
| `SUPER+grave` | toggle AGS sidebar |
| `SUPER+SPACE` | vicinae |
| `SUPER+RETURN` | terminal (ghostty) |
| `SUPER+E` | file manager |
| `SUPER+p` / `SUPER+SHIFT+p` | wall GUI / random wallpaper |
| `SUPER+SHIFT+ESCAPE` | lock |
| `Print` family | screenshots (`screenshot-simple`) |
| `SUPER+F9`, `SUPER+SHIFT+F9`, `SUPER+CTRL+F9` | recording (window, area, all) |
| `SUPER+Q` | close window |
| `SUPER+1..0`, `SUPER+SHIFT+1..0` | workspace focus / move window |

## Window rules (`windows.lua`)

JetBrains dialogs (`class ^jetbrains-.*$`, `title ^win.*$`) float and centre.
Steam games go to the first empty workspace of their monitor. Picture-in-picture is pinned.
There is no rule for `jetbrains-toolbox`; see the known issue below.

## Known issues (as of 2026-11-09)

- **JetBrains Toolbox opens parked off-screen** (`x=-440`). It is an XWayland (Java/AWT) window.
  Absolute `hl.dsp.window.move` and `center` rules do nothing for it. Focusing it by address or
  class does not work. Workaround in `windows.lua` (`window.open` hook, relative moves, from
  hyprwm/Hyprland discussion #16266): it now lands on the active monitor (verified 2026-11-09 on
  HDMI-A-1, workspace 8). The discussion also reports that the window will not tile; not addressed.
  Right-click menu on the tray icon: implemented, not yet verified by clicking.
- **Stale AppImage environment after a Paseo restart.** Paseo runs from an AppImage, and each
  start mounts it at a new `/tmp/.mount_paseo.*`. Shells that started before the restart keep
  `APPDIR`, `APPIMAGE`, `OWD` and a PATH entry pointing at the old mount. Apps launched from such a
  shell (Toolbox was one) fail with `unable to copy files from /tmp/.mount_paseo...`. Open a new
  terminal after restarting Paseo, or unset those variables first.
- **`wall` moved.** The `wall` source repo is now `~/workspace/MyScripts/wall`. `~/.local/bin/wall`
  is a copy, not a symlink, so the installed binary still works. Reinstall it from the new location
  when `wall` changes.

## Where to look first

- Hyprland behaviour and Lua API: `hl.*` in `hypr/.config/hypr/*.lua`, plus the installed
  `hyprland` skill (`~/.claude/skills/hyprland` → `ai-config`).
- AGS: `ags/.config/ags/GEMINI.md`, then `widget/Bar.tsx` and `app.ts`.
- Theme and wallpapers: `scripts/.config/theme/`, `wall` repo.
