-- ============================
-- MONITORS
-- ============================

hl.monitor({
    output   = "DP-2",
    mode     = "1920x1080@165",
    position = "0x0",
    scale    = 1,
})

-- Fallback: auto-place any unconfigured monitor
hl.monitor({
    output   = "",
    mode     = "preferred",
    position = "auto",
    scale    = 1,
})
