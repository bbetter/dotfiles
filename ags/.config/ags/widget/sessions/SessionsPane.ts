// Right pane: templates and saved sessions. Open / replace / alongside / delete.
import { Gtk } from "ags/gtk4"
import { appIcon } from "../utils/appIcon"
import {
  ClosingInfo,
  OpenMode,
  SmSession,
  closingInfo,
  deleteSession,
  listSessions,
  openSession,
} from "./api"

export interface SessionsPaneOpts {
  status: (msg: string, kind?: "info" | "error") => void
  busy: (on: boolean) => void
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

const isSnapshot = (s: SmSession) =>
  s.kind !== "template" && (s.kind !== "broken" || s.path.includes("/sessions/"))

function subtitle(s: SmSession): string {
  if (s.kind === "broken") return `unreadable: ${s.error ?? ""}`
  const n = s.windows.length
  const ws = [...new Set(s.windows.map(w => w.workspace).filter((x): x is number => x != null))].sort(
    (a, b) => a - b,
  )
  return `${n} window${n === 1 ? "" : "s"} · ${ws.length ? `workspace ${ws.join(", ")}` : "auto-placed"}`
}

export function createSessionsPane({ status, busy }: SessionsPaneOpts) {
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  root.add_css_class("sm-sessions")
  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  const scroll = new Gtk.ScrolledWindow({
    vexpand: true,
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    child: list,
  })
  root.append(scroll)

  let sessions: SmSession[] = []
  let expanded: string | null = null
  let confirm: { stem: string; info: ClosingInfo } | null = null
  let deleting: string | null = null
  let showBefore = false
  let working = false

  async function run(what: string, job: () => Promise<string>, done: string) {
    if (working) return
    working = true
    busy(true)
    status(`${what}…`)
    render()
    try {
      await job()
      status(done)
    } catch (e) {
      status(`${what} failed: ${String(e).trim().split("\n").pop()}`, "error")
    } finally {
      working = false
      busy(false)
      confirm = null
      await refresh()
    }
  }

  function open(s: SmSession, mode: OpenMode, newCopy = false) {
    run(`Opening ${s.name}`, () => openSession(s.stem, mode, { newCopy }), `Opened ${s.name}`)
  }

  async function askReplace(s: SmSession) {
    try {
      const info = await closingInfo()
      if (!info.count) return open(s, "replace")
      confirm = { stem: s.stem, info }
      render()
    } catch (e) {
      status(`Could not check what would close: ${e}`, "error")
    }
  }

  function actions(s: SmSession): Gtk.Widget {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    box.add_css_class("sm-actions")

    if (confirm?.stem === s.stem) {
      const c = confirm.info
      box.add_css_class("confirming")
      box.append(label(`Replace closes ${c.count} window${c.count === 1 ? "" : "s"}:`, "sm-strong"))
      box.append(label(c.head, "sm-dim"))
      for (const w of c.warnings) box.append(label(`⚠ ${w}`, "sm-warn"))
      box.append(label("A “Before …” safety snapshot is saved first.", "sm-dim"))
      const row = new Gtk.Box({ spacing: 8 })
      const cancel = button("Cancel")
      cancel.connect("clicked", () => {
        confirm = null
        render()
      })
      const go = button(`Close them and open ${s.name}`, "sm-danger")
      go.connect("clicked", () => open(s, "replace"))
      row.append(cancel)
      row.append(go)
      box.append(row)
      return box
    }

    const row = new Gtk.Box({ spacing: 8 })
    if (s.open) {
      const sw = button("Switch to it", "sm-primary")
      sw.connect("clicked", () => open(s, "switch"))
      const copy = button("Open a second copy")
      copy.connect("clicked", () => open(s, "alongside", true))
      row.append(sw)
      row.append(copy)
    } else {
      const rep = button("Replace current windows…", "sm-primary")
      rep.connect("clicked", () => askReplace(s))
      const alo = button("Open alongside")
      alo.connect("clicked", () => open(s, "alongside"))
      row.append(rep)
      row.append(alo)
    }
    box.append(row)
    return box
  }

  function sessionCard(s: SmSession): Gtk.Widget {
    const isOpen = expanded === s.stem
    const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
    card.add_css_class("sm-session")
    if (isOpen) card.add_css_class("expanded")
    if (s.open) card.add_css_class("running")

    const head = new Gtk.Box({ spacing: 8 })
    const texts = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1, hexpand: true })
    const title = new Gtk.Box({ spacing: 6 })
    if (s.open) title.append(label("●", "sm-ws-active"))
    title.append(label(s.name, "sm-session-name"))
    texts.append(title)
    texts.append(label(subtitle(s), "sm-dim"))
    head.append(texts)

    if (isSnapshot(s)) {
      if (deleting === s.stem) {
        const yes = button("Delete", "sm-danger")
        yes.connect("clicked", () => {
          deleting = null
          run(`Deleting ${s.name}`, () => deleteSession(s.stem), `Deleted ${s.name}`)
        })
        const no = button("Keep")
        no.connect("clicked", () => {
          deleting = null
          render()
        })
        head.append(yes)
        head.append(no)
      } else {
        const del = button("󰩹", "sm-icon")
        del.set_tooltip_text("Delete this saved session")
        del.connect("clicked", () => {
          deleting = s.stem
          render()
        })
        head.append(del)
      }
    }
    card.append(head)

    const click = new Gtk.GestureClick()
    click.connect("released", () => {
      expanded = isOpen ? null : s.stem
      confirm = null
      render()
    })
    texts.add_controller(click)

    if (isOpen) {
      const wins = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 3 })
      wins.add_css_class("sm-session-windows")
      for (const w of s.windows) {
        const r = new Gtk.Box({ spacing: 8 })
        r.append(appIcon(w.class, 16))
        r.append(label(w.class || w.cmd, "sm-win-class"))
        const where = [w.workspace != null ? `ws ${w.workspace}` : "", w.floating ? "float" : ""]
          .filter(Boolean)
          .join(" · ")
        const dim = label(where, "sm-dim")
        dim.set_hexpand(true)
        dim.set_halign(Gtk.Align.END)
        r.append(dim)
        wins.append(r)
      }
      card.append(wins)
      if (s.kind !== "broken") card.append(actions(s))
    }
    return card
  }

  function render() {
    clear(list)
    const group = (title: string, items: SmSession[]) => {
      if (!items.length) return
      list.append(label(title, "sm-group"))
      items.forEach(s => list.append(sessionCard(s)))
    }
    group("TEMPLATES", sessions.filter(s => s.kind === "template"))
    group("SAVED", sessions.filter(s => ["saved", "autosave", "previous", "broken"].includes(s.kind)))

    const before = sessions.filter(s => s.kind === "before")
    if (before.length) {
      const toggle = button(`${showBefore ? "▾" : "▸"} Safety snapshots (${before.length})`, "sm-flat")
      toggle.connect("clicked", () => {
        showBefore = !showBefore
        render()
      })
      list.append(toggle)
      if (showBefore) before.forEach(s => list.append(sessionCard(s)))
    }
    if (!sessions.length) list.append(label("No sessions yet. Tick some windows and save.", "sm-dim"))
    list.set_sensitive(!working)
  }

  async function refresh() {
    try {
      sessions = await listSessions()
    } catch (e) {
      status(`Could not list sessions: ${e}`, "error")
    }
    render()
  }

  refresh()
  return { widget: root, refresh }
}
