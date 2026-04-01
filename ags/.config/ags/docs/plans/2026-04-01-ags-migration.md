# AGS Bar Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port all remaining Waybar widgets to AGS, add a right-side sidebar for contextual/less-used modules, and switch Hyprland autostart from Waybar to AGS.

**Architecture:** The bar stays minimal (always-visible essentials). A collapsible right-side sidebar window holds peripherals, updates, Jarvis, and AIUSH detail. Printer and window title go directly in the bar but hide when inactive. All new widgets follow the existing `createPoll` + GI binding pattern already established in `~/.config/ags/widget/bar/`.

**Tech Stack:** AGS v3 (astal), TypeScript/TSX, GTK4, GLib, astal-* GI bindings, `exec()` for shell scripts where no native binding exists.

---

## Existing state

**AGS already has:** Audio, Bluetooth, Clock, Language, MediaGroup, Network (written, commented out), Notifications, RecordingStatus, SystemTray, Workspaces.

**Waybar backup location:** `~/.dotfiles/waybar-backup/` (created in Task 1).

**Scripts already in AGS:** `~/.config/ags/scripts/recording-status.sh`, `stop-recording.sh`. Waybar scripts live in `~/.dotfiles/waybar/.config/waybar/`.

---

## Task 1: Backup Waybar dotfiles

**Files:**
- Copy: `~/.dotfiles/waybar/` → `~/.dotfiles/waybar-backup/`

**Step 1: Copy the entire waybar dotfiles folder**

```bash
cp -r ~/.dotfiles/waybar ~/.dotfiles/waybar-backup
```

**Step 2: Verify backup**

```bash
ls ~/.dotfiles/waybar-backup/.config/waybar/
```

Expected: same files as `~/.dotfiles/waybar/.config/waybar/` (config, style.css, all .sh scripts).

**Step 3: Commit**

```bash
cd ~/.dotfiles
git add waybar-backup
git commit -m "chore: backup waybar config before AGS migration"
```

---

## Task 2: Copy needed shell scripts to AGS scripts dir

Waybar scripts for jarvis, peripherals, and printer will be reused as-is via `exec()`.

**Files:**
- Copy scripts to: `~/.config/ags/scripts/`

**Step 1: Copy scripts**

```bash
cp ~/.dotfiles/waybar/.config/waybar/jarvis-status.sh ~/.config/ags/scripts/
cp ~/.dotfiles/waybar/.config/waybar/printer-status.sh ~/.config/ags/scripts/
cp ~/.dotfiles/waybar/.config/waybar/peripherals.py ~/.config/ags/scripts/
cp ~/.dotfiles/waybar/.config/waybar/updates.sh ~/.config/ags/scripts/
chmod +x ~/.config/ags/scripts/jarvis-status.sh
chmod +x ~/.config/ags/scripts/printer-status.sh
chmod +x ~/.config/ags/scripts/updates.sh
```

**Step 2: Verify**

```bash
ls ~/.config/ags/scripts/
```

Expected: jarvis-status.sh, printer-status.sh, peripherals.py, updates.sh, recording-status.sh, stop-recording.sh.

---

## Task 3: Window Title widget

Replace the polling shell script approach. Use `AstalHyprland` directly — it fires events when the active window changes, no polling needed.

**Files:**
- Create: `~/.config/ags/widget/bar/WindowTitle.tsx`

**Step 1: Write the widget**

```tsx
import Hyprland from "gi://AstalHyprland"
import { Gtk } from "ags/gtk4"

const APP_REWRITES: Record<string, string> = {
  "firefox":        "🌐",
  "code":           " Code",
  "thunar":         " Files",
  "kitty":          " Terminal",
  "ghostty":        " Terminal",
}

function rewrite(title: string, wm_class: string): string {
  const cls = wm_class.toLowerCase()
  for (const [key, label] of Object.entries(APP_REWRITES)) {
    if (cls.includes(key)) return label
  }
  return title.length > 50 ? title.slice(0, 47) + "…" : title
}

export function WindowTitle() {
  const hypr = Hyprland.get_default()
  const label = new Gtk.Label({ label: "", visible: false })
  label.add_css_class("window-title")

  const update = () => {
    const win = hypr.focusedClient
    if (!win || !win.title) {
      label.visible = false
      return
    }
    label.label = rewrite(win.title, win.class)
    label.visible = true
  }

  update()
  hypr.connect("notify::focused-client", update)

  return label
}
```

**Step 2: Add to Bar.tsx**

In `~/.config/ags/widget/Bar.tsx`, import and add to the left box after `<SystemTray/>`:

```tsx
import { WindowTitle } from "./bar/WindowTitle"
// ...
<box $type="start" hexpand halign={Gtk.Align.START} spacing={8}>
  <Workspaces/>
  <SystemTray/>
  <WindowTitle/>
</box>
```

**Step 3: Add CSS to style.scss**

```scss
.window-title {
  padding: 4px 12px;
  margin-left: 6px;
  border-radius: 6px;
  color: #cdd6f4;
  background: rgba(205, 214, 244, 0.08);
  font-style: italic;
}
```

**Step 4: Run AGS to verify**

```bash
ags run ~/.config/ags
```

Expected: window title appears in left section, updates immediately on window focus change.

**Step 5: Commit**

```bash
cd ~/.config/ags
git add widget/bar/WindowTitle.tsx widget/Bar.tsx style.scss
git commit -m "feat: add reactive window title widget"
```

---

## Task 4: Printer Status widget

Only visible when jobs are in the queue. Calls `lpstat` via `exec()` every 3 seconds.

**Files:**
- Create: `~/.config/ags/widget/bar/Printer.tsx`

**Step 1: Write the widget**

```tsx
import { createPoll } from "ags/time"
import { exec } from "ags/process"

interface PrinterState {
  text: string
  tooltip: string
  visible: boolean
}

function getPrinterState(): PrinterState {
  try {
    const jobs = exec("lpstat -o").trim()
    if (!jobs) return { text: "", tooltip: "", visible: false }

    const lines = jobs.split("\n").filter(Boolean)
    const count = lines.length

    const progress = exec("lpstat -l -o").trim()
    const statusLine = progress.split("\n").find(l => l.includes("Status:"))
    const tooltip = statusLine
      ? statusLine.replace(/.*Status:\s*/, "").trim()
      : lines[0]?.split(/\s+/)[0] ?? ""

    return {
      text: `🖨 ${count} job${count > 1 ? "s" : ""}`,
      tooltip,
      visible: true,
    }
  } catch {
    return { text: "", tooltip: "", visible: false }
  }
}

export function PrinterStatus() {
  const state = createPoll<PrinterState>(
    { text: "", tooltip: "", visible: false },
    3000,
    getPrinterState
  )

  return (
    <button
      class="printer"
      visible={state.as(s => s.visible)}
      tooltipText={state.as(s => s.tooltip)}
    >
      <label label={state.as(s => s.text)} />
    </button>
  )
}
```

**Step 2: Add to Bar.tsx right box**

```tsx
import { PrinterStatus } from "./bar/Printer"
// In the end box, before <RecordingStatus />:
<PrinterStatus />
```

**Step 3: Add CSS**

```scss
.printer {
  padding: 4px 12px;
  margin-right: 6px;
  border-radius: 6px;
  color: #f9e2af;
  background: rgba(249, 226, 175, 0.12);
  transition: all 0.2s ease;
}
```

**Step 4: Verify**

Print something, watch indicator appear. Idle = widget hidden.

**Step 5: Commit**

```bash
git add widget/bar/Printer.tsx widget/Bar.tsx style.scss
git commit -m "feat: add printer status widget"
```

---

## Task 5: Updates widget (bar pill)

Shows update count in the bar. Runs `updates.sh` every 5 minutes (expensive operation).

**Files:**
- Create: `~/.config/ags/widget/bar/Updates.tsx`

**Step 1: Write the widget**

```tsx
import { createPoll } from "ags/time"
import { exec } from "ags/process"
import GLib from "gi://GLib"

interface UpdatesState {
  text: string
  tooltip: string
  visible: boolean
  critical: boolean
}

function getUpdatesState(): UpdatesState {
  try {
    const script = `${GLib.get_home_dir()}/.config/ags/scripts/updates.sh`
    const raw = exec(script).trim()
    if (!raw) return { text: "", tooltip: "", visible: false, critical: false }
    const data = JSON.parse(raw)
    if (!data.text) return { text: "", tooltip: "", visible: false, critical: false }
    return {
      text: data.text,
      tooltip: data.tooltip ?? "",
      visible: true,
      critical: (data.class ?? "").includes("critical"),
    }
  } catch {
    return { text: "", tooltip: "", visible: false, critical: false }
  }
}

export function Updates() {
  const state = createPoll<UpdatesState>(
    { text: "", tooltip: "", visible: false, critical: false },
    300_000, // 5 minutes
    getUpdatesState
  )

  return (
    <button
      class={state.as(s => `updates${s.critical ? " critical" : ""}`)}
      visible={state.as(s => s.visible)}
      tooltipText={state.as(s => s.tooltip)}
    >
      <label label={state.as(s => s.text)} />
    </button>
  )
}
```

**Step 2: Add to Bar.tsx right box**

```tsx
import { Updates } from "./bar/Updates"
// Add before <Audio /> in the end box
<Updates />
```

**Step 3: Add CSS**

```scss
.updates {
  padding: 4px 12px;
  margin-right: 6px;
  border-radius: 6px;
  color: #a6e3a1;
  background: rgba(166, 227, 161, 0.12);

  &.critical {
    color: #f38ba8;
    background: rgba(243, 139, 168, 0.22);
    animation: blink-recording 2s ease-in-out infinite;
  }
}
```

**Step 4: Verify**

```bash
~/.config/ags/scripts/updates.sh
```

Expected: JSON with `text`, `tooltip`, optional `class`.

**Step 5: Commit**

```bash
git add widget/bar/Updates.tsx widget/Bar.tsx style.scss
git commit -m "feat: add system updates indicator"
```

---

## Task 6: Sidebar window skeleton

A right-side drawer that toggles. Bar gets a toggle button.

**Files:**
- Create: `~/.config/ags/widget/Sidebar.tsx`
- Modify: `~/.config/ags/app.ts`
- Modify: `~/.config/ags/widget/Bar.tsx`

**Step 1: Create Sidebar.tsx skeleton**

```tsx
import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"

export function Sidebar(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM } = Astal.WindowAnchor

  return (
    <window
      name="sidebar"
      visible={false}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      anchor={TOP | RIGHT | BOTTOM}
      application={app}
      class="Sidebar"
      widthRequest={320}
    >
      <box orientation={Gtk.Orientation.VERTICAL} spacing={12} class="sidebar-content">
        <label label="Sidebar" class="sidebar-title" />
      </box>
    </window>
  )
}
```

**Step 2: Register sidebar in app.ts**

```ts
import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"
import { Sidebar } from "./widget/Sidebar"

app.start({
  css: style,
  main() {
    app.get_monitors().map(monitor => {
      Bar(monitor)
      Sidebar(monitor)
    })
  },
})
```

**Step 3: Add toggle button to Bar.tsx right box**

```tsx
<button
  class="sidebar-toggle"
  onClicked={() => app.toggle_window("sidebar")}
>
  <label label="⊟" />
</button>
```

**Step 4: Add CSS**

```scss
.Sidebar {
  background: rgba(20, 20, 30, 0.97);
  border-left: 1px solid rgba(100, 150, 255, 0.2);
  color: #e0e0e0;
}

.sidebar-content {
  padding: 16px 12px;
}

.sidebar-title {
  color: #6495ed;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
}

.sidebar-toggle {
  padding: 4px 10px;
  margin-right: 4px;
  border-radius: 6px;
  color: #6c7086;
  background: transparent;
  transition: all 0.2s ease;

  &:hover {
    color: #cdd6f4;
    background: rgba(255, 255, 255, 0.06);
  }
}
```

**Step 5: Verify**

Run AGS. Click toggle button — sidebar panel slides in from right. Click again — hidden.

**Step 6: Commit**

```bash
git add widget/Sidebar.tsx app.ts widget/Bar.tsx style.scss
git commit -m "feat: add collapsible sidebar window"
```

---

## Task 7: Peripherals section in sidebar

Runs `peripherals.py` and displays device battery info in the sidebar.

**Files:**
- Create: `~/.config/ags/widget/sidebar/Peripherals.tsx`
- Modify: `~/.config/ags/widget/Sidebar.tsx`

**Step 1: Write Peripherals sidebar section**

```tsx
import { createPoll } from "ags/time"
import { exec } from "ags/process"
import GLib from "gi://GLib"

interface PeripheralsState {
  text: string
  tooltip: string
}

export function SidebarPeripherals() {
  const state = createPoll<PeripheralsState>(
    { text: "Loading…", tooltip: "" },
    5000,
    () => {
      try {
        const script = `${GLib.get_home_dir()}/.config/ags/scripts/peripherals.py`
        const raw = exec(`python3 ${script}`).trim()
        if (!raw) return { text: "No devices", tooltip: "" }
        const data = JSON.parse(raw)
        return { text: data.text ?? "No devices", tooltip: data.tooltip ?? "" }
      } catch {
        return { text: "Error", tooltip: "" }
      }
    }
  )

  return (
    <box orientation={1} spacing={4} class="sidebar-section">
      <label label="DEVICES" class="sidebar-section-title" halign={1} />
      <label
        label={state.as(s => s.text)}
        class="sidebar-peripherals"
        wrap
        halign={1}
      />
    </box>
  )
}
```

**Step 2: Add to Sidebar.tsx**

```tsx
import { SidebarPeripherals } from "./sidebar/Peripherals"
// In sidebar-content box:
<SidebarPeripherals />
```

**Step 3: Add CSS**

```scss
.sidebar-section {
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.sidebar-section-title {
  font-size: 10px;
  font-weight: 700;
  color: #6c7086;
  letter-spacing: 1.5px;
  margin-bottom: 4px;
}

.sidebar-peripherals {
  color: #cdd6f4;
  font-size: 13px;
}
```

**Step 4: Create sidebar widget directory**

```bash
mkdir -p ~/.config/ags/widget/sidebar
```

**Step 5: Verify**

Open sidebar, confirm device battery info appears and refreshes every 5s.

**Step 6: Commit**

```bash
git add widget/sidebar/Peripherals.tsx widget/Sidebar.tsx style.scss
git commit -m "feat: add peripherals detail to sidebar"
```

---

## Task 8: Jarvis + AIUSH in sidebar

Both read from external sources. Jarvis reads `/tmp/jarvis-status.json`, AIUSH runs the Python script.

**Files:**
- Create: `~/.config/ags/widget/sidebar/Jarvis.tsx`
- Create: `~/.config/ags/widget/sidebar/Aiush.tsx`
- Modify: `~/.config/ags/widget/Sidebar.tsx`

**Step 1: Write Jarvis widget**

```tsx
import { createPoll } from "ags/time"
import { exec } from "ags/process"
import GLib from "gi://GLib"

export function SidebarJarvis() {
  const state = createPoll<{ text: string; tooltip: string }>(
    { text: "", tooltip: "" },
    2000,
    () => {
      try {
        const script = `${GLib.get_home_dir()}/.config/ags/scripts/jarvis-status.sh`
        const raw = exec(script).trim()
        if (!raw) return { text: "Jarvis offline", tooltip: "" }
        const data = JSON.parse(raw)
        return { text: data.text ?? "", tooltip: data.tooltip ?? "" }
      } catch {
        return { text: "Jarvis offline", tooltip: "" }
      }
    }
  )

  const isVisible = createPoll(false, 2000, () => {
    try {
      const script = `${GLib.get_home_dir()}/.config/ags/scripts/jarvis-status.sh`
      const raw = exec(script).trim()
      return !!raw && !!JSON.parse(raw).text
    } catch {
      return false
    }
  })

  return (
    <box orientation={1} spacing={4} class="sidebar-section" visible={isVisible}>
      <label label="JARVIS" class="sidebar-section-title" halign={1} />
      <label label={state.as(s => s.text)} class="sidebar-jarvis" halign={1} />
    </box>
  )
}
```

**Step 2: Write AIUSH widget**

```tsx
import { createPoll } from "ags/time"
import { exec } from "ags/process"

export function SidebarAiush() {
  const state = createPoll<{ text: string; tooltip: string }>(
    { text: "", tooltip: "" },
    60_000,
    () => {
      try {
        const raw = exec("python3 /home/andrii/.local/lib/aiush/aiush.py --once").trim()
        if (!raw) return { text: "", tooltip: "" }
        const data = JSON.parse(raw)
        return { text: data.text ?? "", tooltip: data.tooltip ?? "" }
      } catch {
        return { text: "", tooltip: "" }
      }
    }
  )

  const isVisible = createPoll(false, 60_000, () => {
    try {
      const raw = exec("python3 /home/andrii/.local/lib/aiush/aiush.py --once").trim()
      return !!raw && !!JSON.parse(raw).text
    } catch { return false }
  })

  return (
    <box orientation={1} spacing={4} class="sidebar-section" visible={isVisible}>
      <label label="AIUSH" class="sidebar-section-title" halign={1} />
      <label label={state.as(s => s.text)} class="sidebar-aiush" halign={1} wrap />
    </box>
  )
}
```

**Step 3: Add both to Sidebar.tsx**

```tsx
import { SidebarJarvis } from "./sidebar/Jarvis"
import { SidebarAiush } from "./sidebar/Aiush"
// Add in sidebar-content box after SidebarPeripherals:
<SidebarJarvis />
<SidebarAiush />
```

**Step 4: Add CSS**

```scss
.sidebar-jarvis { color: #89dceb; }
.sidebar-aiush  { color: #a6e3a1; font-size: 12px; }
```

**Step 5: Commit**

```bash
git add widget/sidebar/Jarvis.tsx widget/sidebar/Aiush.tsx widget/Sidebar.tsx style.scss
git commit -m "feat: add Jarvis and AIUSH to sidebar"
```

---

## Task 9: Enable Network widget in bar

It's already written — just uncomment it.

**Files:**
- Modify: `~/.config/ags/widget/Bar.tsx`

**Step 1: Uncomment NetworkIndicator**

In `Bar.tsx`, find the commented import and usage and uncomment both:

```tsx
import { NetworkIndicator } from "./bar/Network"
// and in end box:
<NetworkIndicator />
```

**Step 2: Verify**

Network pill appears in bar with SSID or LAN label.

**Step 3: Commit**

```bash
git add widget/Bar.tsx
git commit -m "feat: enable network indicator in bar"
```

---

## Task 10: Switch Hyprland autostart from Waybar to AGS

**Files:**
- Modify: `~/.dotfiles/hypr/.config/hypr/autostart.conf`

**Step 1: Replace the waybar exec line**

In `autostart.conf`, replace:
```
exec-once = waybar
```
with:
```
exec-once = ags run ~/.config/ags
```

**Step 2: Kill waybar and start AGS for this session**

```bash
pkill waybar; ags run ~/.config/ags &
```

**Step 3: Verify**

Bar appears on screen. All widgets work. Reboot or re-login to confirm autostart works.

**Step 4: Commit**

```bash
cd ~/.dotfiles
git add hypr/.config/hypr/autostart.conf
git commit -m "chore: switch autostart from waybar to ags"
```

---

## Rollback

If anything breaks:

```bash
# Restore Waybar autostart
# Edit ~/.dotfiles/hypr/.config/hypr/autostart.conf → change back to `exec-once = waybar`
pkill ags; waybar &
```

The original Waybar dotfiles remain untouched in `~/.dotfiles/waybar-backup/`.
