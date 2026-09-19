-- ============================
-- MONITORS
-- ============================

hl.monitor({
    output   = "DP-2",
    mode     = "1920x1080@165",
    position = "0x0",
    scale    = 1,
})

-- GW2480, 60Hz/SDR. Pinned explicitly (was falling through the "auto" wildcard
-- below) so its position/order can't shift on a reconnect or reboot, which
-- would silently flip which side SUPER+ALT+left/right moves windows to and
-- break the workspace_rule monitor bindings below.
hl.monitor({
    output   = "HDMI-A-1",
    mode     = "1920x1080@60",
    position = "1920x0",
    scale    = 1,
})

-- Fallback: auto-place any unconfigured monitor
hl.monitor({
    output   = "",
    mode     = "preferred",
    position = "auto",
    scale    = 1,
})
