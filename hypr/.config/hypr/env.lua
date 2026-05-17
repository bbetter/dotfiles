-- ============================
-- ENVIRONMENT
-- ============================

local home = os.getenv("HOME")

hl.env("PATH",           home .. "/.local/bin:/usr/local/bin:/usr/bin:/bin")
hl.env("STEAM_LIB",      "/media/andrii/Entertainment/SteamLibrary/steamapps")
hl.env("XDG_DATA_DIRS",  "/usr/share:/usr/local/share:" .. home .. "/.local/share")

hl.env("XDG_CURRENT_DESKTOP", "Hyprland")
hl.env("XDG_SESSION_TYPE",    "wayland")

hl.env("QT_QPA_PLATFORM",      "wayland")
hl.env("QT_QPA_PLATFORMTHEME", "qt6ct")

hl.env("HYPRCURSOR_SIZE",  "24")
hl.env("HYPRCURSOR_THEME", "rose-pine-hyprcursor")
