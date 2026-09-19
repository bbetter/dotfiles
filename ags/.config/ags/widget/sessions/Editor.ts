// Template editor: a full-width form that replaces the two panes. hypr-sm owns
// the file format and validation; this only collects fields and shows its answers.
import GLib from "gi://GLib"
import { Gtk } from "ags/gtk4"
import { appIcon } from "../utils/appIcon"
import { EditData, EditWindow, OpenWindow, openWindows, showSession, writeSession } from "./api"

const KNOWN = ["cmd", "monitor", "workspace", "cwd", "class", "timeout", "floating", "geometry"]

/** Text fields stay strings while typing; they are parsed once, on Save. */
interface Draft {
  cmd: string
  monitor: "primary" | "secondary"
  workspace: string
  cwd: string
  cls: string
  timeout: string
  floating: boolean
  geometry?: EditWindow["geometry"]
  extra: Record<string, unknown>
}

const blankDraft = (): Draft => ({
  cmd: "", monitor: "primary", workspace: "", cwd: "", cls: "", timeout: "", floating: false, extra: {},
})

function toDraft(w: EditWindow): Draft {
  const extra: Record<string, unknown> = {}
  for (const k of Object.keys(w)) if (!KNOWN.includes(k)) extra[k] = w[k]
  return {
    cmd: w.cmd ?? "",
    monitor: w.monitor === "secondary" ? "secondary" : "primary",
    workspace: w.workspace != null ? String(w.workspace) : "",
    cwd: w.cwd ?? "",
    cls: w.class ?? "",
    timeout: w.timeout != null ? String(w.timeout) : "",
    floating: !!w.floating,
    geometry: w.geometry,
    extra,
  }
}

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

function button(text: string, ...classes: string[]) {
  const b = new Gtk.Button({ label: text })
  b.add_css_class("sm-btn")
  classes.forEach(c => b.add_css_class(c))
  return b
}

function entry(text: string, placeholder: string, chars?: number) {
  const e = new Gtk.Entry({ text, placeholderText: placeholder })
  e.add_css_class("sm-entry")
  if (chars) {
    e.set_width_chars(chars)
    e.set_max_width_chars(chars)
  } else e.set_hexpand(true)
  return e
}

/** A small caption above a control. */
function field(caption: string, child: Gtk.Widget, expand = false) {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 3, hexpand: expand })
  box.append(label(caption, "sm-dim", "sm-caption"))
  box.append(child)
  return box
}

const wholeNumber = (s: string) => /^\d+$/.test(s.trim()) && Number(s) >= 1

export interface EditorOpts {
  /** Called on Save (with what was saved) and on Back (no argument). */
  onClose: (saved?: { stem: string; name: string; warnings: string[] }) => void
}

export function createEditor({ onClose }: EditorOpts) {
  let stem: string | null = null
  let name = ""
  let view = { primary: "", secondary: "" }
  let wins: Draft[] = []
  let dirty = false
  let loading = false
  let backArmed = 0

  const touch = () => {
    if (!loading) dirty = true
  }

  // ── chrome ──────────────────────────────────────────────────────────────
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 })
  root.add_css_class("sm-editor")

  const back = button("← Back")
  const title = label("New template", "sm-title")
  title.set_hexpand(true)
  const saveBtn = button("Save", "sm-primary")
  const top = new Gtk.Box({ spacing: 10 })
  top.append(back)
  top.append(title)
  top.append(saveBtn)
  root.append(top)

  const message = label("", "sm-edit-msg")
  message.set_wrap(true)
  message.set_visible(false)
  const say = (text: string, kind: "error" | "warn" | "" = "") => {
    message.remove_css_class("error")
    message.remove_css_class("warn")
    if (kind) message.add_css_class(kind)
    message.set_label(text)
    message.set_visible(!!text)
  }

  const nameEntry = entry("", "e.g. Android Development")
  nameEntry.connect("changed", () => {
    name = nameEntry.get_text()
    touch()
  })
  const primaryWs = entry("", "keep", 5)
  const secondaryWs = entry("", "keep", 5)
  primaryWs.connect("changed", () => {
    view.primary = primaryWs.get_text()
    touch()
  })
  secondaryWs.connect("changed", () => {
    view.secondary = secondaryWs.get_text()
    touch()
  })

  const meta = new Gtk.Box({ spacing: 16 })
  meta.append(field("NAME", nameEntry, true))
  meta.append(field("SHOW AFTERWARDS: PRIMARY WORKSPACE", primaryWs))
  meta.append(field("SECONDARY WORKSPACE", secondaryWs))
  root.append(meta)

  const listHead = new Gtk.Box({ spacing: 8 })
  const listTitle = label("WINDOWS · launched in this order", "sm-group")
  listTitle.set_hexpand(true)
  const addBtn = button("+ Add window")
  const fromBtn = button("+ From an open window…")
  listHead.append(listTitle)
  listHead.append(addBtn)
  listHead.append(fromBtn)
  root.append(listHead)

  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  const scroll = new Gtk.ScrolledWindow({
    vexpand: true,
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    child: list,
  })
  root.append(scroll)
  root.append(message)

  // ── window cards ────────────────────────────────────────────────────────
  function windowCard(d: Draft, i: number): Gtk.Widget {
    const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
    card.add_css_class("sm-edit-win")

    const cmd = entry(d.cmd, "Command, e.g. google-chrome-stable  (a real program, not a shell function)")
    cmd.connect("changed", () => {
      d.cmd = cmd.get_text()
      touch()
    })
    const up = button("↑", "sm-icon")
    const down = button("↓", "sm-icon")
    const del = button("󰩹", "sm-icon")
    up.set_sensitive(i > 0)
    down.set_sensitive(i < wins.length - 1)
    up.connect("clicked", () => move(i, -1))
    down.connect("clicked", () => move(i, 1))
    del.connect("clicked", () => {
      wins.splice(i, 1)
      touch()
      rebuild()
    })
    const row1 = new Gtk.Box({ spacing: 8 })
    row1.append(label(`${i + 1}`, "sm-ws-id", "sm-edit-index"))
    row1.append(cmd)
    row1.append(up)
    row1.append(down)
    row1.append(del)
    card.append(row1)

    const monitor = Gtk.DropDown.new_from_strings(["primary", "secondary"])
    monitor.set_selected(d.monitor === "secondary" ? 1 : 0)
    monitor.connect("notify::selected", () => {
      d.monitor = monitor.get_selected() === 1 ? "secondary" : "primary"
      touch()
    })
    const ws = entry(d.workspace, "auto", 5)
    ws.connect("changed", () => {
      d.workspace = ws.get_text()
      touch()
    })
    const cwd = entry(d.cwd, "home directory")
    cwd.connect("changed", () => {
      d.cwd = cwd.get_text()
      touch()
    })
    const cls = entry(d.cls, "any (regex)")
    cls.connect("changed", () => {
      d.cls = cls.get_text()
      touch()
    })
    const timeout = entry(d.timeout, "20", 5)
    timeout.connect("changed", () => {
      d.timeout = timeout.get_text()
      touch()
    })
    const floating = new Gtk.CheckButton({ label: "floating", active: d.floating })
    floating.connect("toggled", () => {
      d.floating = floating.get_active()
      touch()
    })

    const row2 = new Gtk.Box({ spacing: 12 })
    row2.append(field("MONITOR", monitor))
    row2.append(field("WORKSPACE", ws))
    row2.append(field("WORKING DIRECTORY", cwd, true))
    row2.append(field("WINDOW CLASS", cls, true))
    row2.append(field("WAIT (S)", timeout))
    const fl = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, valign: Gtk.Align.END })
    fl.append(floating)
    row2.append(fl)
    card.append(row2)

    if (d.geometry) {
      const g = d.geometry
      const row3 = new Gtk.Box({ spacing: 8 })
      row3.append(label(`Saved size and position: ${g.w}×${g.h} at ${g.x},${g.y}`, "sm-dim"))
      const forget = button("Forget", "sm-flat")
      forget.connect("clicked", () => {
        delete d.geometry
        touch()
        rebuild()
      })
      row3.append(forget)
      card.append(row3)
    }
    return card
  }

  function move(i: number, by: number) {
    const j = i + by
    if (j < 0 || j >= wins.length) return
    ;[wins[i], wins[j]] = [wins[j], wins[i]]
    touch()
    rebuild()
  }

  function rebuild() {
    clear(list)
    if (!wins.length) list.append(label("No windows yet. Add one with the buttons above.", "sm-dim"))
    wins.forEach((d, i) => list.append(windowCard(d, i)))
  }

  addBtn.connect("clicked", () => {
    wins.push(blankDraft())
    touch()
    rebuild()
  })

  // "From an open window": a popover listing what could be saved right now.
  let pop: Gtk.Popover | null = null
  fromBtn.connect("clicked", async () => {
    let open: OpenWindow[]
    try {
      open = await openWindows()
    } catch (e) {
      say(`Could not list open windows: ${e}`, "error")
      return
    }
    pop ??= new Gtk.Popover()
    if (!pop.get_parent()) pop.set_parent(fromBtn)
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 })
    box.add_css_class("sm-pop")
    if (!open.length) box.append(label("Nothing saveable is open.", "sm-dim"))
    for (const w of open) {
      const row = new Gtk.Button()
      row.add_css_class("sm-pop-row")
      const inner = new Gtk.Box({ spacing: 8 })
      inner.append(appIcon(w.class, 18))
      inner.append(label(w.title || w.class, "sm-pop-title"))
      row.set_child(inner)
      row.connect("clicked", () => {
        pop?.popdown()
        wins.push(toDraft(w.window))
        touch()
        rebuild()
      })
      box.append(row)
    }
    pop.set_child(box)
    pop.popup()
  })

  // ── save / back ─────────────────────────────────────────────────────────
  /** Turn the drafts into what `hypr-sm write` takes; throws a message the user can act on. */
  function collect(): EditData {
    const n = name.trim()
    if (!n) throw new Error("Give the template a name.")
    if (!wins.length) throw new Error("Add at least one window.")
    const out: EditWindow[] = wins.map((d, i) => {
      const at = `Window ${i + 1}`
      if (!d.cmd.trim()) throw new Error(`${at}: the command is empty.`)
      const w: EditWindow = { monitor: d.monitor, cmd: d.cmd.trim() }
      if (d.cwd.trim()) w.cwd = d.cwd.trim()
      if (d.workspace.trim()) {
        if (!wholeNumber(d.workspace)) throw new Error(`${at}: workspace must be a whole number like 3, or empty for automatic.`)
        w.workspace = Number(d.workspace)
      }
      if (d.floating) w.floating = true
      if (d.geometry) w.geometry = d.geometry
      if (d.cls.trim()) w.class = d.cls.trim()
      if (d.timeout.trim()) {
        const t = Number(d.timeout)
        if (!(t > 0)) throw new Error(`${at}: wait must be a positive number of seconds.`)
        w.timeout = t
      }
      return Object.assign(w, d.extra)
    })
    const data: EditData = { name: n, window: out }
    const v: { primary?: number; secondary?: number } = {}
    for (const role of ["primary", "secondary"] as const) {
      const s = view[role].trim()
      if (!s) continue
      if (!wholeNumber(s)) throw new Error(`Show afterwards (${role}): a whole number like 1, or empty.`)
      v[role] = Number(s)
    }
    if (Object.keys(v).length) data.view = v
    return data
  }

  saveBtn.connect("clicked", async () => {
    say("")
    let data: EditData
    try {
      data = collect()
    } catch (e) {
      say(String((e as Error).message), "error")
      return
    }
    saveBtn.set_sensitive(false)
    try {
      const r = await writeSession(data, stem ?? undefined)
      dirty = false
      onClose({ stem: r.stem, name: data.name, warnings: r.warnings })
    } catch (e) {
      say(String(e).replace(/^hypr-sm: /, ""), "error")
    } finally {
      saveBtn.set_sensitive(true)
    }
  })

  back.connect("clicked", () => {
    if (dirty && !backArmed) {
      back.set_label("Discard changes?")
      backArmed = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 4, () => {
        backArmed = 0
        back.set_label("← Back")
        return false
      })
      return
    }
    if (backArmed) GLib.source_remove(backArmed)
    backArmed = 0
    back.set_label("← Back")
    dirty = false
    onClose()
  })

  /** Show the editor for an existing session/template (stem) or a blank new template. */
  async function load(which: string | null) {
    loading = true
    say("")
    try {
      stem = which
      if (which) {
        const s = await showSession(which)
        const d = s.data
        name = d.name
        view = { primary: d.view?.primary != null ? String(d.view.primary) : "", secondary: d.view?.secondary != null ? String(d.view.secondary) : "" }
        wins = d.window.map(toDraft)
        title.set_label(s.kind === "template" ? "Edit template" : "Edit session")
      } else {
        name = ""
        view = { primary: "", secondary: "" }
        wins = [blankDraft()]
        title.set_label("New template")
      }
      nameEntry.set_text(name)
      primaryWs.set_text(view.primary)
      secondaryWs.set_text(view.secondary)
      rebuild()
      dirty = false
    } finally {
      loading = false
    }
  }

  return { widget: root, load }
}
