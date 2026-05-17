-- ===============================
-- Hyprland entrypoint (Lua)
-- ===============================
-- Backup strategy: all original .conf files are untouched.
-- To revert to hyprlang: rename or delete this file.
-- Hyprland loads hyprland.lua if present, otherwise falls back to hyprland.conf.

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
