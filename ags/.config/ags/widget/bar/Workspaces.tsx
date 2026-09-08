import Hyprland from "gi://AstalHyprland"
import { Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"

// class substring -> themed icon name
const ICON_MAP: Array<[string, string]> = [
  ["firefox", "firefox"],
  ["code", "visual-studio-code"],
  ["telegram", "telegram"],
  ["spotify", "spotify"],
  ["terminal", "terminal"],
  ["foot", "terminal"],
  ["kitty", "terminal"],
  ["ghostty", "terminal"],
]

function iconName(cls: string): string {
  const l = cls.toLowerCase()
  for (const [k, v] of ICON_MAP) if (l.includes(k)) return v
  return l
}

function normAddr(a?: string | null): string | null {
  if (!a) return null
  return a.startsWith("0x") ? a : `0x${a}`
}

// Buttons mask (any mouse button held) for GdkModifierType.
const ANY_BUTTON = 0x7fffff00

export function Workspaces({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const hypr = Hyprland.get_default()
  if (!hypr) return (<box class="workspaces" />) as Gtk.Box

  const connector = gdkmonitor.get_connector() ?? ""
  const RANGE = connector === "DP-2" ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10]

  const box = (<box spacing={4} class="workspaces" />) as Gtk.Box
  const buttons = new Map<number, Gtk.Button>()
  const iconBoxes = new Map<number, Gtk.Box>()

  // Address of the window whose icon is currently being dragged (internal DnD).
  let dragAddr: string | null = null

  const freeSlot = (existing: number[]): number | undefined =>
    RANGE.find(i => !existing.includes(i))

  const onThisMonitor = (): number[] =>
    hypr
      .get_workspaces()
      .filter(ws => ws.id > 0 && ws.monitor && ws.monitor.name === connector)
      .map(ws => ws.id)

  const focusWorkspace = (id: number) => {
    try {
      GLib.spawn_command_line_async(`hyprctl -q dispatch 'hl.dsp.focus({ workspace = ${id} })'`)
    } catch {
      /* ignore */
    }
  }

  const moveToWorkspace = (wsId: number, address: string) => {
    try {
      GLib.spawn_command_line_async(
        `hyprctl -q dispatch 'hl.dsp.window.move({ workspace = ${wsId}, address = "${address}", silent = true })'`,
      )
    } catch {
      /* ignore */
    }
    // notify::clients/workspaces lands slightly after; nudge a few times.
    for (const delay of [40, 160, 360]) {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
        update()
        return false
      })
    }
  }

  // ── icons ────────────────────────────────────────────────────────────────
  const createIcon = (client: any) => {
    const img = new Gtk.Image({ iconName: iconName(client.class || ""), pixelSize: 14 })
    img.add_css_class("workspace-icon")

    const addr = normAddr(client.address)
    if (addr) {
      // Gtk.GestureDrag as a plain drag detector — the drop is resolved from
      // the pointer position, so no ContentProvider / DropTarget marshalling.
      const g = new Gtk.GestureDrag()
      g.connect("drag-begin", () => {
        dragAddr = addr
        img.add_css_class("dragging")
      })
      g.connect("drag-update", () => markDropVisual(pointerWorkspace()?.w ?? null))
      g.connect("drag-end", () => {
        img.remove_css_class("dragging")
        const target = pointerWorkspace()
        if (dragAddr && target && target.id != null) moveToWorkspace(target.id, dragAddr)
        dragAddr = null
        clearDropVisuals()
      })
      img.add_controller(g)
    }
    return img
  }

  const updateIcons = (id: number) => {
    const iconBox = iconBoxes.get(id)
    if (!iconBox) return
    let child = iconBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      iconBox.remove(child)
      child = next
    }
    const seen = new Set<string>()
    for (const client of hypr.get_clients()) {
      if (!client.workspace || client.workspace.id !== id) continue
      if (!client.class || seen.has(client.class)) continue
      seen.add(client.class)
      iconBox.append(createIcon(client))
    }
  }

  // ── the "+" button (spill onto a fresh workspace) ───────────────────────
  const plusBtn = (
    <button
      class="workspace-plus"
      visible={false}
      onClicked={() => {
        const next = freeSlot(onThisMonitor())
        const addr = normAddr(hypr.get_focused_client()?.address)
        if (next != null && addr) moveToWorkspace(next, addr)
      }}
    >
      <label label="+" />
    </button>
  ) as Gtk.Button

  // ── main render ────────────────────────────────────────────────────────
  const update = () => {
    const activeId = hypr.focusedWorkspace?.id ?? -1
    const ids = onThisMonitor().sort((a, b) => a - b)
    if (activeId > 0 && !ids.includes(activeId) && RANGE.includes(activeId)) {
      ids.push(activeId)
      ids.sort((a, b) => a - b)
    }

    let changed = false
    for (const [id, btn] of buttons) {
      if (!ids.includes(id)) {
        box.remove(btn)
        buttons.delete(id)
        iconBoxes.delete(id)
        changed = true
      }
    }

    for (const id of ids) {
      if (!buttons.has(id)) {
        // Plain constructors, not JSX — update() runs outside a component
        // tracking context (timers / signal handlers).
        const iconBox = new Gtk.Box({ spacing: 4 })
        const inner = new Gtk.Box({ spacing: 6 })
        inner.append(new Gtk.Label({ label: id === 10 ? "0" : `${id}` }))
        inner.append(iconBox)

        const btn = new Gtk.Button()
        btn.add_css_class("workspace-btn")
        btn.set_child(inner)
        btn.connect("clicked", () => focusWorkspace(id))

        buttons.set(id, btn)
        iconBoxes.set(id, iconBox)
        changed = true
      }

      const btn = buttons.get(id)!
      btn[id === activeId ? "add_css_class" : "remove_css_class"]("active")
      const occupied = hypr.get_clients().some(c => c.workspace && c.workspace.id === id)
      btn[occupied ? "add_css_class" : "remove_css_class"]("occupied")
      updateIcons(id)
    }

    // Re-order the box if the id sequence or membership changed.
    const domIds: number[] = []
    for (let c = box.get_first_child(); c; c = c.get_next_sibling()) {
      for (const [id, btn] of buttons) if (btn === c) domIds.push(id)
    }
    if (
      changed ||
      domIds.length !== ids.length ||
      domIds.some((id, i) => id !== ids[i]) ||
      plusBtn.get_parent() !== box
    ) {
      for (let c = box.get_first_child(); c; ) {
        const next = c.get_next_sibling()
        box.remove(c)
        c = next
      }
      for (const id of ids) box.append(buttons.get(id)!)
      box.append(plusBtn)
    }

    plusBtn.set_visible(freeSlot(ids) != null)
  }

  // Which workspace button (or "+") is under a root-space point?
  const widgetUnder = (px: number, py: number): { id: number | null; w: Gtk.Widget } | null => {
    const root = box.get_root() as Gtk.Window | null
    if (!root) return null
    const [ok, bx, by] = box.translate_coordinates(root, 0, 0)
    if (!ok) return null
    const hit = (w: Gtk.Widget) => {
      const a = w.get_allocation()
      return px >= bx + a.x && px <= bx + a.x + a.width && py >= by + a.y && py <= by + a.y + a.height
    }
    for (const [id, btn] of buttons) if (hit(btn)) return { id, w: btn }
    if (plusBtn.get_visible() && hit(plusBtn)) return { id: freeSlot([...buttons.keys()]) ?? null, w: plusBtn }
    return null
  }

  const pointerState = (): { x: number; y: number; mask: number } | null => {
    const surface = (box.get_root() as Gtk.Window | null)?.get_surface()
    const pointer = Gdk.Display.get_default()?.get_default_seat()?.get_pointer()
    if (!surface || !pointer) return null
    const [, x, y, mask] = surface.get_device_position(pointer)
    return { x, y, mask }
  }

  const pointerWorkspace = () => {
    const p = pointerState()
    return p ? widgetUnder(p.x, p.y) : null
  }

  const clearDropVisuals = () => {
    for (const btn of buttons.values()) btn.remove_css_class("drop-target")
    plusBtn.remove_css_class("drop-target")
    box.remove_css_class("hover")
  }
  const markDropVisual = (w: Gtk.Widget | null) => {
    for (const btn of buttons.values()) btn[btn === w ? "add_css_class" : "remove_css_class"]("drop-target")
    plusBtn[plusBtn === w ? "add_css_class" : "remove_css_class"]("drop-target")
    box[w ? "add_css_class" : "remove_css_class"]("hover")
  }

  // ── external drag ─────────────────────────────────────────────────────────
  // A Hyprland window dragged from the desktop onto the bar is NOT a GTK drag.
  // Poll the GDK button mask (cheap, no Hyprland IPC); on a *real* drag (moved
  // > threshold) released over a workspace button, move the focused client
  // there. Inert while an internal icon drag (Gtk.GestureDrag) is running, and
  // a plain click can't trigger it.
  let lastMask = 0
  let pressX = 0
  let pressY = 0
  const DRAG_THRESHOLD = 24

  const extPoll = () => {
    const p = pointerState()
    const mask = p?.mask ?? 0
    const pressed = (mask & ANY_BUTTON) !== 0
    const wasPressed = (lastMask & ANY_BUTTON) !== 0
    lastMask = mask

    if (dragAddr) return true // internal icon drag owns the drop
    if (!p || (!pressed && !wasPressed)) return true

    if (pressed && !wasPressed) {
      pressX = p.x
      pressY = p.y
    }
    if (wasPressed && !pressed) {
      const moved = Math.abs(p.x - pressX) + Math.abs(p.y - pressY)
      const under = widgetUnder(p.x, p.y)
      if (moved > DRAG_THRESHOLD && under && under.id != null) {
        const addr = normAddr(hypr.get_focused_client()?.address)
        if (addr) moveToWorkspace(under.id, addr)
      }
    }
    return true
  }
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60, extPoll)

  update()
  hypr.connect("notify::focused-workspace", update)
  hypr.connect("notify::workspaces", update)
  hypr.connect("notify::clients", update)

  return box
}
