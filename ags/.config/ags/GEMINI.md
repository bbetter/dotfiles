# AGS Configuration Guide (Astal/GTK4)

This document outlines the architectural patterns and multi-monitor handling for this specific AGS setup to ensure stability and simplify future development.

## 🖥️ Multi-Monitor Architecture

Unlike some configurations that try to manage monitors globally, this setup uses a **per-monitor initialization** pattern.

### 1. Initialization Pattern (`app.ts`)
Windows are not defined statically. Instead, an `initWindows(monitor: Gdk.Monitor)` function is called for every monitor found at startup and whenever a new monitor is connected.

```typescript
// app.ts
function initWindows(monitor: Gdk.Monitor) {
  Bar(monitor)
  Sidebar(monitor)
  // ... popups
}

// Startup
app.get_monitors().forEach(initWindows)

// Hot-plugging (Gdk.Display way)
const monitorsList = Gdk.Display.get_default()?.get_monitors()
monitorsList?.connect("items-changed", (list, pos, removed, added) => {
  if (added > 0) initWindows(list.get_item(pos))
})
```

### 2. Unique Naming Convention
To avoid window name collisions in the `app` registry, every window **must** include the monitor connector name in its ID:
*   **Pattern:** `[window-type]-[monitorName]`
*   **Example:** `bar-DP-2`, `network-popup-HDMI-A-1`

## 🪟 Popup & Sidebar Management

### 1. The Manager Pattern (`PopupManager.ts`)
Popups use a centralized manager to handle backdrops.
*   **Backdrops:** Every monitor has a hidden backdrop window. When *any* popup on that monitor opens, the manager shows the backdrop for *that specific monitor*.
*   **Focus:** Popups are set to `keymode={Astal.Keymode.ON_DEMAND}`.

### 2. Focus Handling
GTK4 windows in Wayland often won't grab focus automatically. For search entries:
1.  Set `keymode` on the Window.
2.  Connect to `notify::visible` and call `entry.grab_focus()` when `visible` becomes true.

### 3. Sidebar State
The sidebar uses `hyprctl monitors -j` to determine which monitor is currently focused by the user and opens the sidebar windows on that specific monitor.

## ⚠️ Common Gotchas & API Standards

### 1. Property Observation
**Avoid** `observe_property("visible", ...)`. It is non-standard in many GJS environments and caused crashes.
**Use** the standard GObject notification:
```typescript
win.connect("notify::visible", (w) => {
  if (w.visible) /* ... */
})
```

### 2. GTK4 Event Handling
GTK4 moved away from `button-press-event`.
**Use** `Gtk.GestureClick` for clicks/presses:
```typescript
const gesture = Gtk.GestureClick.new()
gesture.connect("pressed", () => { /* logic */ })
widget.add_controller(gesture)
```

### 3. Monitor Detection in Widgets
When a widget in the Bar needs to toggle a popup, it must find the popup belonging to its own monitor:
```typescript
export function togglePopup(sourceWidget: Gtk.Widget) {
    const root = sourceWidget.get_root() as any
    const monitor = root.gdkmonitor // The Bar window stores its monitor here
    const handle = _handles.get(monitor)
    handle?.toggle(sourceWidget)
}
```

## 📂 Directory Structure
*   `widget/`: Main window definitions (`Bar.tsx`, `Sidebar.tsx`).
*   `widget/bar/`: Small components inside the bar.
*   `widget/sidebar/`: Components inside the sidebar.
*   `widget/utils/`: Helper functions like `positioning.ts` for popups.
