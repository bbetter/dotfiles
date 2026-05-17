-- ============================
-- AUTOSTART
-- ============================

local home = os.getenv("HOME")

hl.on("hyprland.start", function()
    hl.exec_cmd("dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP")
    hl.exec_cmd("systemctl --user import-environment WAYLAND_DISPLAY XDG_CURRENT_DESKTOP")
    hl.exec_cmd("hyprpm reload -n")
    hl.exec_cmd("wl-paste --watch cliphist store")
    hl.exec_cmd("ags run " .. home .. "/.config/ags")
    hl.exec_cmd("swaync")
    hl.exec_cmd("/usr/lib/polkit-kde-authentication-agent-1")
    hl.exec_cmd("sleep 10 && " .. home .. "/MyScripts/release_monitor.sh")
    hl.exec_cmd("wall random")
    hl.exec_cmd("vicinae server")
    hl.exec_cmd("snappy-switcher --daemon")
    hl.exec_cmd(home .. "/.config/scripts/theme-watcher.sh")
end)
