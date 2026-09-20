// Generic dmenu-style picker: replaces `fuzzel --dmenu` in the menus (theme, keybinds,
// clipboard, browser) so they share the shell's theme and keyboard handling.
//
//   ags request picker <items-file> [prompt] [with-nth]
//
// <items-file> holds one item per line. A tab splits an item into columns: the first is
// shown as a key, the rest dimmed. `with-nth` N hides the first N-1 columns (cliphist:
// "id<TAB>text" -> N=2). The request is answered when the user decides:
//   "ok<TAB><index>"  (0-based line of the file)   or   "cancel"
// The wrapper `ags-pick` (~/.local/bin) does the file/answer plumbing and falls back to fuzzel.
import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Hyprland from "gi://AstalHyprland"

const MAX_ROWS = 60 // rows drawn at once; typing narrows the rest down

interface Item {
  index: number
  cols: string[]
  hay: string // lower-cased text the filter looks at
}

let win: Astal.Window | null = null
let ui: ReturnType<typeof build> | null = null
let answer: ((r: string) => void) | null = null

function finish(result: string) {
  const a = answer
  answer = null
  win?.set_visible(false)
  a?.(result)
}

function readItems(file: string, nth: number): Item[] {
  const [ok, bytes] = GLib.file_get_contents(file)
  if (!ok) throw new Error(`cannot read ${file}`)
  const lines = new TextDecoder().decode(bytes).split("\n")
  if (lines.length && lines[lines.length - 1] === "") lines.pop() // trailing newline
  return lines.map((line, index) => {
    const cols = line.split("\t").slice(Math.max(0, nth - 1))
    return { index, cols: cols.length ? cols : [line], hay: cols.join(" ").toLowerCase() }
  })
}

function build() {
  const w = new Astal.Window({
    name: "picker",
    application: app,
    visible: false,
    layer: Astal.Layer.OVERLAY,
    keymode: Astal.Keymode.EXCLUSIVE,
    exclusivity: Astal.Exclusivity.IGNORE,
    anchor: Astal.WindowAnchor.TOP,
    marginTop: 160,
  })
  w.add_css_class("PickerWindow")

  const prompt = new Gtk.Label({ xalign: 0 })
  prompt.add_css_class("pk-prompt")
  const entry = new Gtk.Entry({ hexpand: true, placeholderText: "Type to filter…" })
  entry.add_css_class("pk-entry")
  const top = new Gtk.Box({ spacing: 10 })
  top.append(prompt)
  top.append(entry)

  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  list.add_css_class("pk-list")
  const scroll = new Gtk.ScrolledWindow({
    child: list,
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    propagateNaturalHeight: true,
    maxContentHeight: 440,
  })

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8, widthRequest: 620 })
  box.add_css_class("pk-box")
  box.append(top)
  box.append(scroll)
  w.set_child(box)

  return { w, prompt, entry, list, scroll }
}

export function showPicker(file: string, promptText: string, nth: number, respond: (r: string) => void) {
  if (answer) finish("cancel") // a newer request wins over one nobody answered
  const items = readItems(file, nth)

  ui ??= wire(build())
  win = ui.w
  answer = respond
  // Without a monitor the compositor picks one (it chose the unfocused screen). The window is
  // hidden here, so switching monitors is allowed.
  const focused = Hyprland.get_default().focusedMonitor?.name
  const monitor = app.get_monitors().find(m => m.get_connector() === focused)
  if (monitor) win.set_gdkmonitor(monitor)
  ui.open(items, promptText)
}

/** Everything that needs the built widgets. Runs once. */
function wire(b: ReturnType<typeof build>) {
  const { w, prompt, entry, list, scroll } = b
  let items: Item[] = []
  let shown: Item[] = []
  let sel = 0
  let rows: Gtk.Box[] = []

  const setSel = (i: number) => {
    if (!rows.length) return
    sel = Math.max(0, Math.min(rows.length - 1, i))
    rows.forEach((r, n) => (n === sel ? r.add_css_class("selected") : r.remove_css_class("selected")))
    // keep the selected row inside the viewport
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      const row = rows[sel]
      const adj = scroll.get_vadjustment()
      if (!row || !adj) return false
      const h = row.get_height()
      const top = sel * h
      if (top < adj.get_value()) adj.set_value(top)
      else if (top + h > adj.get_value() + adj.get_page_size()) adj.set_value(top + h - adj.get_page_size())
      return false
    })
  }

  const accept = (i: number) => {
    const it = shown[i]
    if (it) finish(`ok\t${it.index}`)
  }

  const render = () => {
    const tokens = entry.get_text().toLowerCase().split(/\s+/).filter(Boolean)
    const hits = tokens.length ? items.filter(it => tokens.every(t => it.hay.includes(t))) : items
    shown = hits.slice(0, MAX_ROWS)

    for (let c = list.get_first_child(); c; c = list.get_first_child()) list.remove(c)
    rows = []

    // first column as a fixed-width "key" only when items really have several columns
    const keyWidth = Math.min(30, Math.max(0, ...shown.map(it => (it.cols.length > 1 ? it.cols[0].length : 0))))
    shown.forEach((it, n) => {
      const row = new Gtk.Box({ spacing: 14 })
      row.add_css_class("pk-row")
      if (it.cols.length > 1) {
        const key = new Gtk.Label({ label: it.cols[0], xalign: 0, widthChars: keyWidth, maxWidthChars: 30, ellipsize: 3 })
        key.add_css_class("pk-key")
        row.append(key)
      }
      const text = new Gtk.Label({
        label: it.cols.length > 1 ? it.cols.slice(1).join("  ") : it.cols[0],
        xalign: 0,
        hexpand: true,
        ellipsize: 3,
        maxWidthChars: 1,
      })
      text.add_css_class(it.cols.length > 1 ? "pk-dim" : "pk-text")
      row.append(text)
      const click = new Gtk.GestureClick()
      click.connect("released", () => accept(n))
      row.add_controller(click)
      list.append(row)
      rows.push(row)
    })
    if (!shown.length) {
      const none = new Gtk.Label({ label: "No matches", xalign: 0 })
      none.add_css_class("pk-empty")
      list.append(none)
    } else if (hits.length > shown.length) {
      const more = new Gtk.Label({ label: `${hits.length - shown.length} more… keep typing`, xalign: 0 })
      more.add_css_class("pk-empty")
      list.append(more)
    }
    scroll.get_vadjustment()?.set_value(0)
    setSel(0)
  }

  entry.connect("changed", render)
  entry.connect("activate", () => accept(sel))

  // Capture phase, so Up/Down/Esc reach us before the entry moves its cursor.
  const keys = new Gtk.EventControllerKey({ propagationPhase: Gtk.PropagationPhase.CAPTURE })
  keys.connect("key-pressed", (_c, keyval, _code, state) => {
    const ctrl = (state & Gdk.ModifierType.CONTROL_MASK) !== 0
    switch (keyval) {
      case Gdk.KEY_Escape:
        finish("cancel")
        return true
      case Gdk.KEY_Down:
      case Gdk.KEY_Tab:
        setSel(sel + 1)
        return true
      case Gdk.KEY_Up:
      case Gdk.KEY_ISO_Left_Tab:
        setSel(sel - 1)
        return true
      case Gdk.KEY_Page_Down:
        setSel(sel + 8)
        return true
      case Gdk.KEY_Page_Up:
        setSel(sel - 8)
        return true
    }
    if (ctrl) {
      if (keyval === Gdk.KEY_n || keyval === Gdk.KEY_j) return setSel(sel + 1), true
      if (keyval === Gdk.KEY_p || keyval === Gdk.KEY_k) return setSel(sel - 1), true
    }
    return false
  })
  w.add_controller(keys)

  return {
    w,
    open(newItems: Item[], promptText: string) {
      items = newItems
      prompt.set_label(promptText)
      prompt.set_visible(!!promptText)
      entry.set_text("")
      render()
      w.present()
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        entry.grab_focus()
        return false
      })
    },
  }
}
