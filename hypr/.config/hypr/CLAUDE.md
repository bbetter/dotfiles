# 165Hz + HDR experiment log (BenQ EX2510S on DP-2)

Tracking the migration from the known-working 144Hz/SDR setup to true 165Hz
and HDR, staged so instability can be isolated to a specific change. Each
stage is a git tag in this repo (`~/.dotfiles`) covering `monitors.lua` and
`look.lua`. Use `./fallback.sh <tag>` (in this directory) to roll back a
stage without hunting through git log.

## Hardware/software context

- GPU: AMD RX 9070 XT (RDNA4, amdgpu driver)
- Compositor: Hyprland 0.56.0
- Monitor: BenQ EX2510S on DP-2, EDID-confirmed HDR10 support (SMPTE ST2084
  EOTF, ~418 cd/m² desired max luminance) — real HDR panel, not just BenQ's
  "HDRi" OSD gimmick. Also has a genuine 165Hz CVT mode distinct from its
  143.98Hz native timing.
- Second monitor HDMI-A-1 (BenQ GW2480) is 60Hz/SDR only, unaffected by this.

## Stages

### `hypr-baseline-2026-08-01` — known-good starting point
- Commit: a1aeeb0e446083a5caf4b979a6a7284d45e35524
- `monitors.lua`: `mode = "1920x1080@144"` — this actually resolves to the
  monitor's native **143.98Hz** detailed timing, NOT the real 165Hz mode.
- No color management config anywhere (`hyprctl monitors` confirms
  `colorManagementPreset: srgb`, `sdrMaxLuminance: 80` placeholder — HDR was
  never enabled).
- `misc.vrr = 1` globally (already on). `blur` and `shadows` enabled in
  `decoration`.
- Two prior (empty/unreadable) Hyprland crash reports exist from before this
  tag (2026-05-06, 2026-06-17) — predate any HDR/165Hz work, so likely
  unrelated to this experiment.

### `hypr-stage-a-165hz` — real 165Hz, still no HDR
- Change: `monitors.lua` mode → explicit `"1920x1080@165"`.
- Goal: confirm plain high-refresh-rate operation is stable before adding
  HDR into the mix. If crashes/artifacts/flicker still occur here, the cause
  is refresh-rate/VRR/driver related, not HDR.
- Secondary diagnostic if unstable: temporarily set `misc.vrr = 0` to check
  whether adaptive sync is the trigger.

### `hypr-stage-b-hdr` — HDR on top of stage A
- Change: add `cm = hdredid` to the DP-2 monitor rule (uses the panel's real
  EDID luminance values rather than a generic HDR preset).
- Diagnostic: test with `blur`/`shadows` temporarily disabled first — that
  combination is a known Hyprland artifact source under HDR output.
- Expected, not a bug: SDR/non-HDR-aware apps (most browsers, XWayland apps)
  will look washed out or overly bright once the output switches to HDR —
  general Wayland color-management state right now, not fixable via config.

## Rolling back

```
cd ~/.dotfiles/hypr/.config/hypr
./fallback.sh hypr-baseline-2026-08-01   # back to 144Hz/SDR, no HDR
./fallback.sh hypr-stage-a-165hz         # back to 165Hz/SDR, no HDR
./fallback.sh hypr-stage-b-hdr           # re-apply HDR stage if reverted
```

The script restores `monitors.lua`/`look.lua` from the tag and runs
`hyprctl reload`. It only touches the working tree — commit afterward if you
want the rollback itself recorded in history. Note the nightly
`dotfiles-auto-commit.timer` (23:00) will auto-commit whatever state the
working tree is in, tagged or not.

If a stage causes a hard crash rather than just visual artifacts, get a
real crash report next time (the two existing ones are empty) by watching
`~/.cache/hyprland/` immediately after the crash, before anything else
touches that directory.
