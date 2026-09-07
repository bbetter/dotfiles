-- ============================
-- ENVIRONMENT
-- ============================

local home = os.getenv("HOME")

-- PATH: Hyprland is started from .zprofile (no display manager) BEFORE .zshrc
-- adds the user tool dirs, so its inherited PATH lacks ~/.local/bin, cargo,
-- bun, the Android SDK, etc. The old value here clobbered PATH down to 4 dirs;
-- this instead prepends the real tool dirs onto a full system PATH. Static
-- list (Hyprland's `env` can't reference $PATH) — extend if a new toolchain
-- dir is added to the shell rc.
hl.env("PATH", table.concat({
    home .. "/.local/bin",
    home .. "/.local/share/JetBrains/Toolbox/scripts",
    home .. "/.pyenv/shims",
    home .. "/.cargo/bin",
    home .. "/.bun/bin",
    home .. "/Android/Sdk/platform-tools",
    home .. "/Android/Sdk/cmdline-tools/latest/bin",
    home .. "/Android/Sdk/emulator",
    "/usr/local/sbin", "/usr/local/bin", "/usr/bin", "/usr/sbin", "/bin", "/sbin",
    "/usr/lib/jvm/default/bin",
    "/usr/bin/site_perl", "/usr/bin/vendor_perl", "/usr/bin/core_perl",
    "/opt/rocm/bin",
}, ":"))

hl.env("STEAM_LIB", "/media/andrii/Entertainment/SteamLibrary/steamapps")

hl.env("XDG_CURRENT_DESKTOP", "Hyprland")
hl.env("XDG_SESSION_TYPE",    "wayland")

hl.env("QT_QPA_PLATFORM",      "wayland")
hl.env("QT_QPA_PLATFORMTHEME", "qt6ct")

-- Cursor: hyprcursor for native Wayland clients, xcursor for XWayland/GTK.
-- rose-pine-hyprcursor ships hyprcursor format only, so XWayland falls back
-- to Adwaita (install AUR `rose-pine-cursor` for a matching xcursor theme).
hl.env("HYPRCURSOR_SIZE",  "24")
hl.env("HYPRCURSOR_THEME", "rose-pine-hyprcursor")
hl.env("XCURSOR_SIZE",     "24")
hl.env("XCURSOR_THEME",    "Adwaita")

-- App-platform hints
hl.env("MOZ_ENABLE_WAYLAND",           "1")
hl.env("ELECTRON_OZONE_PLATFORM_HINT", "auto")  -- Discord / VS Code native Wayland
hl.env("_JAVA_AWT_WM_NONREPARENTING",  "1")      -- JetBrains / Java AWT grey-window fix
