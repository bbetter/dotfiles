-- ==================================================
-- KEYBINDS
-- ==================================================

local mainMod    = "SUPER"
local home       = os.getenv("HOME")
local terminal   = "ghostty"
local fileManager = "thunar"

-- ==================================================
-- SYSTEM / SESSION
-- ==================================================

hl.bind(mainMod .. " + SHIFT + L", hl.dsp.exec_cmd("swaylock"))
hl.bind(mainMod .. " + Q",         hl.dsp.window.close())
hl.bind(mainMod .. " + SHIFT + Q", hl.dsp.exit())
hl.bind(mainMod .. " + W",         hl.dsp.exec_cmd(home .. "/.config/hypr/toggle-ags.sh"))
hl.bind(mainMod .. " + grave",     hl.dsp.exec_cmd(home .. "/.config/hypr/toggle-ags-sidebar.sh"))

-- ==================================================
-- LAUNCHERS
-- ==================================================

hl.bind(mainMod .. " + SPACE",  hl.dsp.exec_cmd("vicinae toggle"))
hl.bind(mainMod .. " + B",      hl.dsp.exec_cmd(home .. "/.local/bin/browser-select"))
hl.bind(mainMod .. " + RETURN", hl.dsp.exec_cmd('sh -c "GDK_BACKEND=wayland ' .. terminal .. '"'))
hl.bind(mainMod .. " + E",      hl.dsp.exec_cmd(fileManager))
hl.bind(mainMod .. " + T",      hl.dsp.exec_cmd("thunderbird"))

-- ==================================================
-- WINDOW NAVIGATION & MOVEMENT
-- ==================================================

-- Focus (super + arrows / hjkl)
hl.bind(mainMod .. " + left",  hl.dsp.focus({ direction = "l" }))
hl.bind(mainMod .. " + right", hl.dsp.focus({ direction = "r" }))
hl.bind(mainMod .. " + up",    hl.dsp.focus({ direction = "u" }))
hl.bind(mainMod .. " + down",  hl.dsp.focus({ direction = "d" }))
hl.bind(mainMod .. " + h",     hl.dsp.focus({ direction = "l" }))
hl.bind(mainMod .. " + l",     hl.dsp.focus({ direction = "r" }))
hl.bind(mainMod .. " + j",     hl.dsp.focus({ direction = "u" }))
hl.bind(mainMod .. " + k",     hl.dsp.focus({ direction = "d" }))

-- Move windows (super + shift + arrows / hjkl)
hl.bind(mainMod .. " + SHIFT + left",  hl.dsp.window.swap({ direction = "l" }))
hl.bind(mainMod .. " + SHIFT + right", hl.dsp.window.swap({ direction = "r" }))
hl.bind(mainMod .. " + SHIFT + up",    hl.dsp.window.swap({ direction = "u" }))
hl.bind(mainMod .. " + SHIFT + down",  hl.dsp.window.swap({ direction = "d" }))
hl.bind(mainMod .. " + SHIFT + h",     hl.dsp.window.swap({ direction = "l" }))
hl.bind(mainMod .. " + SHIFT + l",     hl.dsp.window.swap({ direction = "r" }))
hl.bind(mainMod .. " + SHIFT + j",     hl.dsp.window.swap({ direction = "u" }))
hl.bind(mainMod .. " + SHIFT + k",     hl.dsp.window.swap({ direction = "d" }))

-- Resize windows (super + ctrl + arrows)
hl.bind(mainMod .. " + CTRL + left",  hl.dsp.window.resize({ x = -40, y =   0, relative = true }))
hl.bind(mainMod .. " + CTRL + right", hl.dsp.window.resize({ x =  40, y =   0, relative = true }))
hl.bind(mainMod .. " + CTRL + up",    hl.dsp.window.resize({ x =   0, y = -40, relative = true }))
hl.bind(mainMod .. " + CTRL + down",  hl.dsp.window.resize({ x =   0, y =  40, relative = true }))
hl.bind(mainMod .. " + CTRL + h",     hl.dsp.window.resize({ x = -40, y =   0, relative = true }))
hl.bind(mainMod .. " + CTRL + l",     hl.dsp.window.resize({ x =  40, y =   0, relative = true }))
hl.bind(mainMod .. " + CTRL + j",     hl.dsp.window.resize({ x =   0, y = -40, relative = true }))
hl.bind(mainMod .. " + CTRL + k",     hl.dsp.window.resize({ x =   0, y =  40, relative = true }))

-- Toggle floating / fullscreen
hl.bind(mainMod .. " + F",         hl.dsp.window.float({ action = "toggle" }))
hl.bind(mainMod .. " + SHIFT + F", hl.dsp.window.fullscreen({ action = "toggle" }))

-- Alt+Tab
hl.bind("ALT + TAB",         hl.dsp.exec_cmd("snappy-switcher next"))
hl.bind("ALT + SHIFT + TAB", hl.dsp.exec_cmd("snappy-switcher prev"))

-- ==================================================
-- THEMES
-- ==================================================

hl.bind(mainMod .. " + F1", hl.dsp.exec_cmd(home .. "/.config/scripts/theme-menu.sh"))
hl.bind(mainMod .. " + Y",  hl.dsp.exec_cmd(home .. "/.config/scripts/theme-menu.sh"))

-- ==================================================
-- WORKSPACES
-- ==================================================

-- hl.bind(mainMod .. " + grave", ...) -- hyprtasking:toggle (plugin, not yet migrated)
-- hl.bind("escape", ...)              -- hyprtasking:if_active (plugin, not yet migrated)

for i = 1, 9 do
    hl.bind(mainMod .. " + " .. i,         hl.dsp.focus({ workspace = i }))
    hl.bind(mainMod .. " + SHIFT + " .. i, hl.dsp.window.move({ workspace = i }))
end
hl.bind(mainMod .. " + 0",         hl.dsp.focus({ workspace = 10 }))
hl.bind(mainMod .. " + SHIFT + 0", hl.dsp.window.move({ workspace = 10 }))

-- Scroll through workspaces with mouse wheel
hl.bind(mainMod .. " + mouse_down", hl.dsp.focus({ workspace = "e+1" }))
hl.bind(mainMod .. " + mouse_up",   hl.dsp.focus({ workspace = "e-1" }))

-- ==================================================
-- MONITORS (super + alt)
-- ==================================================

hl.bind(mainMod .. " + ALT + left",  hl.dsp.window.move({ monitor = "l" }))
hl.bind(mainMod .. " + ALT + right", hl.dsp.window.move({ monitor = "r" }))
hl.bind(mainMod .. " + ALT + h",     hl.dsp.window.move({ monitor = "l" }))
hl.bind(mainMod .. " + ALT + l",     hl.dsp.window.move({ monitor = "r" }))

-- ==================================================
-- WALLPAPERS
-- ==================================================

hl.bind(mainMod .. " + p",         hl.dsp.exec_cmd(home .. "/.local/bin/wall-gui"))
hl.bind(mainMod .. " + SHIFT + p", hl.dsp.exec_cmd(home .. "/.local/bin/wall random"))

-- ==================================================
-- SCRATCHPADS
-- ==================================================

hl.bind(mainMod .. " + S",         hl.dsp.workspace.toggle_special("magic"))
hl.bind(mainMod .. " + SHIFT + S", hl.dsp.window.move({ workspace = "special:magic" }))

-- ==================================================
-- SCREENSHOTS
-- ==================================================

hl.bind("Print",                hl.dsp.exec_cmd(home .. "/.local/bin/screenshot-simple area-clip"))
hl.bind("SHIFT + Print",        hl.dsp.exec_cmd(home .. "/.local/bin/screenshot-simple area-file"))
hl.bind("CTRL + Print",         hl.dsp.exec_cmd(home .. "/.local/bin/screenshot-simple full-clip"))
hl.bind("CTRL + SHIFT + Print", hl.dsp.exec_cmd(home .. "/.local/bin/screenshot-simple full-file"))

-- ==================================================
-- RECORDING
-- ==================================================

hl.bind(mainMod .. " + F9",              hl.dsp.exec_cmd(home .. "/.config/ags/scripts/start-recording-window.sh"))
hl.bind(mainMod .. " + SHIFT + F9",     hl.dsp.exec_cmd(home .. "/.config/ags/scripts/start-recording-area.sh"))
hl.bind(mainMod .. " + CTRL + F9",      hl.dsp.exec_cmd(home .. "/.config/ags/scripts/start-recording-all.sh"))
hl.bind(mainMod .. " + F10",            hl.dsp.exec_cmd(home .. "/.config/ags/scripts/stop-recording.sh"))

-- ==================================================
-- CLIPBOARD
-- ==================================================

hl.bind(mainMod .. " + V", hl.dsp.exec_cmd("cliphist list | fuzzel --dmenu | cliphist decode | wl-copy"))

-- ==================================================
-- MOUSE
-- ==================================================

hl.bind(mainMod .. " + mouse:272", hl.dsp.window.drag(),   { mouse = true })
hl.bind(mainMod .. " + mouse:273", hl.dsp.window.resize(), { mouse = true })
hl.bind("mouse:276",               hl.dsp.window.drag(),   { mouse = true })

-- ==================================================
-- HELP
-- ==================================================

hl.bind(mainMod .. " + SHIFT + H", hl.dsp.exec_cmd(home .. "/.config/hypr/show-binds.sh"))
