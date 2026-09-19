-- ===============================
-- Hyprland entrypoint (Lua)
-- ===============================
-- Native Lua config: Hyprland loads this file directly and there is no
-- hyprland.conf. Each dofile() below is one concern; `hyprctl reload`
-- re-evaluates them all.

local home    = os.getenv("HOME")
local confDir = home .. "/.config/hypr/"

dofile(confDir .. "env.lua")
dofile(confDir .. "autostart.lua")
dofile(confDir .. "monitors.lua")
dofile(confDir .. "workspaces.lua")
dofile(confDir .. "look.lua")
dofile(confDir .. "plugins.lua")
dofile(confDir .. "input.lua")
dofile(confDir .. "windows.lua")
dofile(confDir .. "binds.lua")
