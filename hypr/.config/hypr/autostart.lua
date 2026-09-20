-- ============================
-- AUTOSTART
-- ============================
--
-- Long-running helpers are systemd user units, so they restart on failure, log to
-- the journal (`journalctl --user -u 'hypr-*'`) and start in a defined order.
-- Units: ./systemd/*  (linked into ~/.config/systemd/user by install.sh).
--   status : systemctl --user status hyprland-session.target 'hypr-*'
--   restart: systemctl --user restart hypr-ags   (AGS, e.g. after editing widgets)
-- The packaged swaync / hypridle / vicinae units are reused; the rest are ours.

local home = os.getenv("HOME")

hl.on("hyprland.start", function()
    -- Hand this session's environment (WAYLAND_DISPLAY, HYPRLAND_INSTANCE_SIGNATURE,
    -- PATH and the hl.env() values from env.lua) to systemd and D-Bus, then (re)start
    -- the session target. "restart", not "start": after a Hyprland crash the old
    -- services would otherwise keep a dead compositor's socket. The three packaged
    -- units are not PartOf our target, so they are listed explicitly.
    hl.exec_cmd([[sh -c 'dbus-update-activation-environment --systemd --all;
        systemctl --user restart hyprland-session.target swaync.service hypridle.service vicinae.service']])

    -- Not a unit on purpose: `wall` manages its own daemon and wallpaper engines, and
    -- a unit would kill them whenever the session target restarts.
    -- No monitor arg: `wall` shuffles every monitor independently, or (when
    -- `wall mirror` is on) the primary only and fans out. Matches the theme mode.
    hl.exec_cmd("wall shuffle 900")

    -- No polkit authentication agent is installed (the old polkit-kde line pointed at a
    -- file that does not exist). Install e.g. `hyprpolkitagent` and add it here.
end)
