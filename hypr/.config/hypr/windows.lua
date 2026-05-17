-- ============================
-- WINDOW & LAYER RULES
-- ============================

-- Layer rules
hl.layer_rule({ match = { namespace = "vicinae" }, blur = true, ignore_alpha = 0, no_anim = true })

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
hl.window_rule({ match = { class = "^(jetbrains-*)$", title = "^(win.*)$" }, float = true, center = true })

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

-- Gaming
hl.window_rule({ match = { class = "^(steam_app_500810)$" }, stay_focused = true, immediate = true })
hl.window_rule({ match = { class = "^(steam_app_110800)$" }, stay_focused = true, immediate = true })

-- Wallpaper preview
hl.window_rule({
    match = { title = "^(wall-preview)" },
    float = true,
    size  = { 640, 360 },
    move  = { "(monitor_w*0.70)", "(monitor_h*0.20)" },
})
