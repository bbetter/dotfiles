import Hyprland from "gi://AstalHyprland"
import { Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import GObject from "gi://GObject"
import Gio from "gi://Gio"

// Drag debug log — `tail -f /tmp/ags-ws.log`
const WS_LOG = "/tmp/ags-ws.log"
function wsLog(msg: string) {
  try {
    const f = Gio.File.new_for_path(WS_LOG)
    const s = f.query_exists(null)
      ? f.append_to(Gio.FileCreateFlags.NONE, null)
      : f.create(Gio.FileCreateFlags.NONE, null)
    s.write_all(new TextEncoder().encode(`${new Date().toISOString().slice(11, 23)}  ${msg}\n`), null)
    s.close(null)
  } catch {
    /* ignore */
  }
}

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


export function Workspaces({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const hypr = Hyprland.get_default()
  if (!hypr) return (<box class="workspaces" />) as Gtk.Box

  const connector = gdkmonitor.get_connector() ?? ""
  const RANGE = connector === "DP-2" ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10]

  const box = (<box spacing={4} class="workspaces" />) as Gtk.Box
  const buttons = new Map<number, Gtk.Button>()
  const iconBoxes = new Map<number, Gtk.Box>()

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
    const cli = hypr.get_clients().find(c => normAddr(c.address) === address)
    wsLog(`  -> MOVE ${cli?.class ?? "?"} ${address}  toWs=${wsId}`)
    try {
      // `window = "address:0x…"` targets a specific window; `address`/`silent`
      // keys are silently ignored (it would move the *active* window instead).
      GLib.spawn_command_line_async(
        `hyprctl -q dispatch 'hl.dsp.window.move({ window = "address:${address}", workspace = ${wsId}, follow = false })'`,
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

  // ── icons (native Gtk.DragSource) ────────────────────────────────────────
  const stringContent = (s: string) => {
    const v = new GObject.Value()
    v.init(GObject.TYPE_STRING)
    v.set_string(s)
    return Gdk.ContentProvider.new_for_value(v)
  }

  const dragIcon = (cls: string): Gdk.Paintable | null => {
    try {
      const disp = Gdk.Display.get_default()
      if (!disp) return null
      return Gtk.IconTheme.get_for_display(disp).lookup_icon(
        iconName(cls), null, 24, 1, Gtk.TextDirection.NONE, 0,
      ) as unknown as Gdk.Paintable
    } catch {
      return null
    }
  }

  const createIcon = (client: any) => {
    const img = new Gtk.Image({ iconName: iconName(client.class || ""), pixelSize: 14 })
    img.add_css_class("workspace-icon")

    const addr = normAddr(client.address)
    const cls = client.class || "?"
    if (addr) {
      const src = new Gtk.DragSource({ actions: Gdk.DragAction.MOVE })
      src.connect("prepare", () => stringContent(addr))
      src.connect("drag-begin", () => {
        const p = dragIcon(cls)
        if (p) src.set_icon(p, 12, 12)
        img.add_css_class("dragging")
        wsLog(`ICON drag-begin  grabbed=${cls} ${addr} fromWs=${client.workspace?.id ?? "?"}`)
      })
      src.connect("drag-end", () => img.remove_css_class("dragging"))
      src.connect("drag-cancel", () => {
        img.remove_css_class("dragging")
        return false
      })
      img.add_controller(src)
    }
    return img
  }

  // ── drop target on a workspace button / the "+" ─────────────────────────
  const attachDrop = (widget: Gtk.Widget, resolveWsId: () => number | null) => {
    const dt = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE)
    dt.connect("enter", () => {
      widget.add_css_class("drop-target")
      box.add_css_class("hover")
      return Gdk.DragAction.MOVE
    })
    dt.connect("leave", () => {
      widget.remove_css_class("drop-target")
      box.remove_css_class("hover")
    })
    dt.connect("drop", (_dt: any, value: string) => {
      widget.remove_css_class("drop-target")
      box.remove_css_class("hover")
      const wsId = resolveWsId()
      const addr = normAddr(value)
      wsLog(`ICON drop        value=${value}  targetWs=${wsId ?? "none"}`)
      if (wsId != null && addr) moveToWorkspace(wsId, addr)
      return true
    })
    widget.add_controller(dt)
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
  attachDrop(plusBtn, () => freeSlot(onThisMonitor()) ?? null)

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
        attachDrop(btn, () => id)

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

  update()
  hypr.connect("notify::focused-workspace", update)
  hypr.connect("notify::workspaces", update)
  hypr.connect("notify::clients", update)

  return box
}
