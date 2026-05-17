-- ============================
-- LOOK & FEEL
-- ============================

local home = os.getenv("HOME")

hl.config({
    general = {
        gaps_in     = 4,
        gaps_out    = 4,
        border_size = 3,
        ["col.active_border"]   = { colors = { "rgba(c39e74ff)", "rgba(d2b898ff)" }, angle = 45 },
        ["col.inactive_border"] = "rgba(21170fff)",
        resize_on_border = true,
        allow_tearing    = false,
        layout           = "dwindle",
    },

    decoration = {
        rounding       = 8,
        rounding_power = 2,
        active_opacity   = 1.0,
        inactive_opacity = 1.0,
        shadow = {
            enabled      = true,
            range        = 4,
            render_power = 3,
            color          = "rgba(c39e74ee)",
            color_inactive = "rgba(1a1a1aee)",
        },
        blur = {
            enabled = true,
            size    = 3,
            passes  = 1,
        },
    },

    group = {
        ["col.border_active"]   = { colors = { "rgba(c39e74ff)", "rgba(d2b898ff)" }, angle = 45 },
        ["col.border_inactive"] = "rgba(21170fff)",
        groupbar = {
            ["col.active"]   = "rgba(c39e74ff)",
            ["col.inactive"] = "rgba(21170fff)",
        },
    },

    animations = {
        enabled = true,
    },

    dwindle = {
        preserve_split = true,
    },

    master = {
        new_status = "master",
    },

    misc = {
        force_default_wallpaper = 0,
        disable_hyprland_logo   = true,
        vrr                     = 1,
    },
})

-- Bezier curves
hl.curve("easeOutQuint",   { type = "bezier", points = { { 0.23, 1.0  }, { 0.32, 1.0 } } })
hl.curve("easeInOutCubic", { type = "bezier", points = { { 0.65, 0.05 }, { 0.36, 1.0 } } })
hl.curve("quick",          { type = "bezier", points = { { 0.15, 0.0  }, { 0.1,  1.0 } } })

-- Animations
hl.animation({ leaf = "windows",    enabled = true, speed = 4.5, bezier = "easeOutQuint"   })
hl.animation({ leaf = "fade",       enabled = true, speed = 2.0, bezier = "quick"          })
hl.animation({ leaf = "workspaces", enabled = true, speed = 2.2, bezier = "easeInOutCubic" })

-- Theme color overrides (loaded last so theme-watcher changes take effect)
-- Note: update ~/.config/scripts/theme-watcher.sh to write hyprland-colors.lua alongside .conf
local themeFile = home .. "/.config/theme/hyprland-colors.lua"
local f = io.open(themeFile, "r")
if f then
    f:close()
    dofile(themeFile)
end
