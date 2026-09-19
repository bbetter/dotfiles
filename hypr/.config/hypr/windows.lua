-- ============================
-- WINDOW & LAYER RULES
-- ============================

-- Layer rules
hl.layer_rule({ match = { namespace = "vicinae" }, blur = true, ignore_alpha = 0, no_anim = true })

-- AGS bar / sidebar / popups (all AGS windows share this namespace). Frosted
-- glass behind the translucent bar pills; ignore_alpha keeps fully-transparent
-- bar gaps from picking up a blur haze.
hl.layer_rule({ match = { namespace = "gtk4-layer-shell" }, blur = true, ignore_alpha = 0.05, xray = false })

-- Notification centre + toasts
hl.layer_rule({ match = { namespace = "swaync-control-center" },     blur = true, ignore_alpha = 0.2 })
hl.layer_rule({ match = { namespace = "swaync-notification-window" }, blur = true, ignore_alpha = 0.2 })

-- Suppress maximize events globally
hl.window_rule({ match = { class = ".*" }, suppress_event = "maximize" })

-- Ignore focus requests from unowned XWayland floating windows
hl.window_rule({
    match = { class = "^$", title = "^$", xwayland = true, float = true, fullscreen = false, pin = false },
    no_focus = true,
})

-- Screen sharing
hl.window_rule({ match = { class = "^(xdg-desktop-portal-hyprland)$" }, no_blur = true, no_anim = true })

-- JetBrains dialogs
hl.window_rule({ match = { class = "^(jetbrains-.*)$", title = "^(win.*)$" }, float = true, center = true })

-- Picture-in-Picture
hl.window_rule({
    match = { title = "^(Picture-in-Picture)$" },
    float = true,
    pin   = true,
    size  = { "(monitor_w*0.25)", "(monitor_h*0.25)" },
})

-- File pickers
hl.window_rule({ match = { title = "^(Open File)$" }, float = true })
hl.window_rule({ match = { title = "^(Save File)$" }, float = true })

-- Discord
hl.window_rule({ match = { title = "^(Discord Updater)$" }, float = true })

-- Android Emulator
hl.window_rule({
    match = { title = "^(Android Emulator)$" },
    float = true,
    size  = { "(monitor_w*0.40)", "(monitor_h*0.80)" },
    move  = { "(monitor_w*0.59)", "(monitor_h*0.10)" },
})

-- Logcat scratchpad
hl.window_rule({ match = { title = "^(Logcat)$" }, workspace = "special:logcat" })

-- Password prompts
hl.window_rule({ match = { class = "^(polkit-.*)$" }, float = true, center = true })

-- Simple dialogs
hl.window_rule({ match = { title = "^(Confirm|Authentication|Permission)$" }, float = true, center = true })

-- Gaming: Steam games get WM_CLASS "steam_app_<appid>" from the runtime wrapper.
-- Always land them on the first empty workspace of the monitor they opened on
-- (not wherever the cursor happened to drift to while the game was loading).
hl.window_rule({
    match        = { class = "^(steam_app_.*)$" },
    workspace    = "emptym",
    stay_focused = true,
    immediate    = true,
})

-- Wallpaper preview
hl.window_rule({
    match = { title = "^(wall-preview)" },
    float = true,
    size  = { 640, 360 },
    move  = { "(monitor_w*0.70)", "(monitor_h*0.20)" },
})

-- hypr-sm session manager (AGS window, title set in widget/Sessions.ts)
hl.window_rule({
    match  = { title = "^hypr-sm sessions$" },
    float  = true,
    center = true,
    size   = { 1180, 760 },
})
