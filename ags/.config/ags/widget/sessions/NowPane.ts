// Left pane: what is open right now, per monitor and workspace. Windows can be
// dragged onto another workspace and ticked for a partial save.
import Hyprland from "gi://AstalHyprland"
import GLib from "gi://GLib"
import GObject from "gi://GObject"
import { Gtk, Gdk } from "ags/gtk4"
import { appIcon } from "../utils/appIcon"
import { WINDOW_TITLE, focusWindow, moveWindow, workspaceRanges } from "./api"

export interface NowPaneOpts {
  selected: Set<string>
  /** addrs = null means "everything saveable". */
  save: (name: string, addrs: string[] | null) => void
  status: (msg: string, kind?: "info" | "error") => void
}

const normAddr = (a?: string | null) => (a ? (a.startsWith("0x") ? a : `0x${a}`) : "")

function clear(box: Gtk.Box) {
  for (let c = box.get_first_child(); c; ) {
    const next = c.get_next_sibling()
    box.remove(c)
    c = next
  }
}

function label(text: string, ...classes: string[]) {
  const l = new Gtk.Label({ label: text, xalign: 0 })
  classes.forEach(c => l.add_css_class(c))
  return l
}

export function createNowPane({ selected, save, status }: NowPaneOpts) {
  const hypr = Hyprland.get_default()

  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  root.add_css_class("sm-now")
  root.set_hexpand(true)

  const columns = new Gtk.Box({ spacing: 12, homogeneous: true })
  columns.set_vexpand(true)
  root.append(columns)

  // ── footer: selection + save ────────────────────────────────────────────
  const count = label("", "sm-dim")
  const selAll = new Gtk.Button({ label: "Select all" })
  const selNone = new Gtk.Button({ label: "Clear" })
  const nameEntry = new Gtk.Entry({ placeholderText: "Name for a new persistent session", hexpand: true })
  const saveBtn = new Gtk.Button({ label: "Save session" })
  ;[selAll, selNone].forEach(b => b.add_css_class("sm-btn"))
  saveBtn.add_css_class("sm-btn")
  saveBtn.add_css_class("sm-primary")
  nameEntry.add_css_class("sm-entry")

  const footer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  footer.add_css_class("sm-footer")
  const pickRow = new Gtk.Box({ spacing: 8 })
  count.set_hexpand(true)
  pickRow.append(count)
  pickRow.append(selAll)
  pickRow.append(selNone)
  const saveRow = new Gtk.Box({ spacing: 8 })
  saveRow.append(nameEntry)
  saveRow.append(saveBtn)
  footer.append(pickRow)
  footer.append(saveRow)
  root.append(footer)

  let shown: string[] = []
  let ranges: Record<string, number[]> = {}
  let dragging = false
  let pending = false
  let timer = 0

  const updateCount = () => {
    count.set_label(
      selected.size ? `${selected.size} selected` : "nothing ticked: saves every window",
    )
  }

  const doSave = () => {
    const name = nameEntry.get_text().trim()
    if (!name) {
      status("Give it a name first", "error")
      nameEntry.grab_focus()
      return
    }
    save(name, selected.size ? [...selected] : null)
  }
  saveBtn.connect("clicked", doSave)
  nameEntry.connect("activate", doSave)
  selAll.connect("clicked", () => {
    shown.forEach(a => selected.add(a))
    rebuild()
  })
  selNone.connect("clicked", () => {
    selected.clear()
    rebuild()
  })

  // ── rows and cards ──────────────────────────────────────────────────────
  const stringContent = (s: string) => {
    const v = new GObject.Value()
    v.init(GObject.TYPE_STRING)
    v.set_string(s)
    return Gdk.ContentProvider.new_for_value(v)
  }

  function windowRow(c: Hyprland.Client): Gtk.Widget {
    const addr = normAddr(c.address)
    const row = new Gtk.Box({ spacing: 8 })
    row.add_css_class("sm-win")

    const check = new Gtk.CheckButton({ active: selected.has(addr) })
    check.connect("toggled", () => {
      if (check.get_active()) selected.add(addr)
      else selected.delete(addr)
      updateCount()
    })
    row.append(check)
    row.append(appIcon(c.class ?? "", 18))

    const title = new Gtk.Label({
      label: c.title || c.class || addr,
      xalign: 0,
      hexpand: true,
      ellipsize: 3, // Pango.EllipsizeMode.END
      maxWidthChars: 1,
    })
    title.set_tooltip_text(`${c.class}\n${c.title}`)
    row.append(title)
    if (c.floating) row.append(label("float", "sm-badge"))

    const src = new Gtk.DragSource({ actions: Gdk.DragAction.MOVE })
    src.connect("prepare", () => stringContent(addr))
    src.connect("drag-begin", () => {
      dragging = true
      row.add_css_class("dragging")
      src.set_icon(new Gtk.WidgetPaintable({ widget: row }), 12, 12)
    })
    src.connect("drag-end", () => {
      dragging = false
      row.remove_css_class("dragging")
      if (pending) schedule()
    })
    row.add_controller(src)

    const click = new Gtk.GestureClick()
    click.connect("pressed", (_g, nPress) => {
      if (nPress === 2) focusWindow(addr).catch(e => status(String(e), "error"))
    })
    row.add_controller(click)
    return row
  }

  function workspaceCard(id: number, active: boolean, clients: Hyprland.Client[]): Gtk.Widget {
    const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
    card.add_css_class("sm-ws")
    if (active) card.add_css_class("active")
    if (!clients.length) card.add_css_class("empty")

    const head = new Gtk.Box({ spacing: 6 })
    head.append(label(`${id}`, "sm-ws-id"))
    if (active) head.append(label("●", "sm-ws-active"))
    const n = label(clients.length ? `${clients.length}` : "empty · drop windows here", "sm-dim")
    n.set_hexpand(true)
    n.set_halign(Gtk.Align.END)
    head.append(n)
    card.append(head)

    for (const c of clients) card.append(windowRow(c))

    const dt = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE)
    dt.connect("enter", () => {
      card.add_css_class("drop-target")
      return Gdk.DragAction.MOVE
    })
    dt.connect("leave", () => card.remove_css_class("drop-target"))
    dt.connect("drop", (_dt: any, value: string) => {
      card.remove_css_class("drop-target")
      const addr = normAddr(value)
      const from = hypr.get_clients().find(c => normAddr(c.address) === addr)
      if (!addr || !from || from.workspace?.id === id) return false
      moveWindow(addr, id).catch(e => status(`Move failed: ${e}`, "error"))
      return true
    })
    card.add_controller(dt)
    return card
  }

  function rebuild() {
    pending = false
    clear(columns)
    const clients = hypr
      .get_clients()
      .filter(c => c.title !== WINDOW_TITLE && c.workspace && c.workspace.id > 0)
    const alive = new Set(clients.map(c => normAddr(c.address)))
    for (const a of [...selected]) if (!alive.has(a)) selected.delete(a)
    shown = [...alive]

    const monitors = [...hypr.get_monitors()].sort((a, b) => a.x - b.x || a.y - b.y)
    for (const m of monitors) {
      const activeId = (m as any).activeWorkspace?.id ?? -1
      const ids = new Set<number>(ranges[m.name] ?? [])
      for (const c of clients) if (c.monitor?.name === m.name) ids.add(c.workspace.id)
      if (activeId > 0) ids.add(activeId)

      const col = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
      col.add_css_class("sm-monitor")
      col.append(label(m.name, "sm-monitor-name"))
      const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
      for (const id of [...ids].sort((a, b) => a - b)) {
        list.append(
          workspaceCard(
            id,
            id === activeId,
            clients.filter(c => c.workspace.id === id),
          ),
        )
      }
      const sc = new Gtk.ScrolledWindow({
        vexpand: true,
        hscrollbarPolicy: Gtk.PolicyType.NEVER,
        child: list,
      })
      col.append(sc)
      columns.append(col)
    }
    updateCount()
  }

  /** Coalesce bursts of Hyprland events; never rebuild under an active drag. */
  function schedule() {
    if (dragging) {
      pending = true
      return
    }
    if (timer) return
    timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 70, () => {
      timer = 0
      if (dragging) pending = true
      else rebuild()
      return false
    })
  }

  workspaceRanges().then(r => {
    ranges = r
    schedule()
  })
  rebuild()

  return { widget: root, refresh: schedule, clearName: () => nameEntry.set_text("") }
}
