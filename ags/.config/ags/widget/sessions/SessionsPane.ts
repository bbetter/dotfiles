// Right pane. PERSISTENT sessions (named by you, kept until deleted) on top;
// RECENT ones (autosave, previous session, safety snapshots) below. Any session
// opens the same way; naming a recent one makes it persistent.
import GLib from "gi://GLib"
import { Gtk } from "ags/gtk4"
import { appIcon } from "../utils/appIcon"
import {
  ClosingInfo,
  OpenMode,
  SmSession,
  closingInfo,
  deleteSession,
  duplicateSession,
  listSessions,
  openSession,
  persistSession,
  renameSession,
} from "./api"

export interface SessionsPaneOpts {
  status: (msg: string, kind?: "info" | "error") => void
  busy: (on: boolean) => void
  /** Open the editor for this persistent session, or a new one (null). */
  edit: (stem: string | null) => void
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

/** hypr-sm prints "hypr-sm: <reason>" on stderr; show just the reason. */
const reason = (e: unknown) =>
  String(e).trim().split("\n").pop()!.replace(/^(Error: )?(hypr-sm: )?/, "")

type NamingMode = "rename" | "persist" | "duplicate"

/** Does a session match the search text (name, or any window's class or command)? */
function matches(s: SmSession, q: string): boolean {
  return (
    s.name.toLowerCase().includes(q) ||
    s.windows.some(w => `${w.class} ${w.cmd}`.toLowerCase().includes(q))
  )
}

function subtitle(s: SmSession): string {
  if (s.kind === "broken") return `unreadable: ${s.error ?? ""}`
  const n = s.windows.length
  const ws = [...new Set(s.windows.map(w => w.workspace).filter((x): x is number => x != null))].sort(
    (a, b) => a - b,
  )
  return `${n} window${n === 1 ? "" : "s"} · ${ws.length ? `workspace ${ws.join(", ")}` : "auto-placed"}`
}

export function createSessionsPane({ status, busy, edit }: SessionsPaneOpts) {
  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  root.add_css_class("sm-sessions")
  const list = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  const scroll = new Gtk.ScrolledWindow({
    vexpand: true,
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    child: list,
  })
  const newBtn = button("+ New session", "sm-flat-primary")
  newBtn.connect("clicked", () => edit(null))
  const search = new Gtk.SearchEntry({ placeholderText: "Search sessions…", hexpand: true })
  search.add_css_class("sm-entry")
  const top = new Gtk.Box({ spacing: 8 })
  top.append(newBtn)
  top.append(search)
  root.append(top)
  root.append(scroll)

  let sessions: SmSession[] = []
  let expanded: string | null = null
  let confirm: { stem: string; info: ClosingInfo } | null = null
  let deleting: string | null = null
  let naming: { stem: string; mode: NamingMode; text?: string } | null = null
  let query = ""
  let showBefore = false
  let working = false

  async function run(what: string, job: () => Promise<string>, done: string, after?: (out: string) => void) {
    if (working) return
    working = true
    busy(true)
    status(`${what}…`)
    render()
    try {
      const out = await job()
      after?.(out)
      status(done)
    } catch (e) {
      status(`${what} failed: ${reason(e)}`, "error")
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
      status(`Could not check what would close: ${reason(e)}`, "error")
    }
  }

  /** Inline name prompt: renames a persistent session, or names a recent one (= makes it persistent). */
  function namingRow(s: SmSession, mode: NamingMode): Gtk.Widget {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    box.add_css_class("sm-actions")
    if (mode === "persist") {
      box.append(
        label("Give it a name to keep it. It moves to the persistent list and is never removed automatically.", "sm-dim"),
      )
    } else if (mode === "duplicate") {
      box.append(label("Creates a new persistent session from this one. The original stays as it is.", "sm-dim"))
    }
    const row = new Gtk.Box({ spacing: 8 })
    const entry = new Gtk.Entry({
      text: naming?.text ?? (mode === "rename" ? s.name : mode === "duplicate" ? `${s.name} copy` : ""),
      placeholderText: "Name (required)",
      hexpand: true,
    })
    entry.add_css_class("sm-entry")
    const go = button(mode === "rename" ? "Rename" : mode === "duplicate" ? "Duplicate" : "Make persistent", "sm-primary")
    const cancel = button("Cancel")
    const submit = () => {
      const name = entry.get_text().trim()
      if (!name) return status("A persistent session needs a name", "error")
      // Stay in naming mode (with the typed text) until it succeeds, so a rejected
      // name (e.g. a duplicate) doesn't cost the user what they typed.
      naming = { stem: s.stem, mode, text: name }
      if (mode === "rename") {
        run(`Renaming ${s.name}`, () => renameSession(s.stem, name), `Renamed to “${name}”`, () => {
          naming = null
        })
      } else if (mode === "duplicate") {
        run(`Duplicating ${s.name}`, () => duplicateSession(s.stem, name), `Created “${name}”`, stem => {
          expanded = stem
          naming = null
        })
      } else {
        run(
          `Saving ${s.name}`,
          () => persistSession(s.stem, name),
          `“${name}” is now persistent`,
          stem => {
            expanded = stem // follow the session to its new place in the list
            naming = null
          },
        )
      }
    }
    entry.connect("activate", submit)
    go.connect("clicked", submit)
    cancel.connect("clicked", () => {
      naming = null
      render()
    })
    row.append(entry)
    row.append(go)
    row.append(cancel)
    box.append(row)
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      entry.grab_focus()
      entry.select_region(0, -1)
      return false
    })
    return box
  }

  function actions(s: SmSession): Gtk.Widget {
    if (naming?.stem === s.stem) return namingRow(s, naming.mode)

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
    if (s.persistent) {
      const editBtn = button("Edit")
      editBtn.connect("clicked", () => edit(s.stem))
      const rename = button("Rename")
      rename.connect("clicked", () => {
        naming = { stem: s.stem, mode: "rename" }
        render()
      })
      const dup = button("Duplicate…")
      dup.connect("clicked", () => {
        naming = { stem: s.stem, mode: "duplicate" }
        render()
      })
      row.append(editBtn)
      row.append(rename)
      row.append(dup)
    } else {
      const keep = button("Make persistent…")
      keep.connect("clicked", () => {
        naming = { stem: s.stem, mode: "persist" }
        render()
      })
      row.append(keep)
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
      del.set_tooltip_text("Delete this session")
      del.connect("clicked", () => {
        deleting = s.stem
        render()
      })
      head.append(del)
    }
    card.append(head)

    const click = new Gtk.GestureClick()
    click.connect("released", () => {
      expanded = isOpen ? null : s.stem
      confirm = null
      naming = null
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
        const where = [
          w.workspace != null ? `ws ${w.workspace}` : "",
          w.floating ? "float" : "",
          w.tabs ? `${w.tabs} tab${w.tabs === 1 ? "" : "s"}` : "",
          w.cwd ?? "",
        ]
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
    const shown = query ? sessions.filter(s => matches(s, query)) : sessions
    const persistent = shown.filter(s => s.persistent)
    const recent = shown.filter(s => !s.persistent && s.kind !== "before")
    const before = shown.filter(s => s.kind === "before")

    if (query && !shown.length) list.append(label(`No session matches “${query}”.`, "sm-dim", "sm-hint"))
    if (!query || persistent.length) list.append(label("PERSISTENT", "sm-group"))
    if (persistent.length) persistent.forEach(s => list.append(sessionCard(s)))
    else if (!query) {
      list.append(
        label("Nothing persistent yet. Save what's open, create a session, or name a recent one.", "sm-dim", "sm-hint"),
      )
    }

    if (recent.length) {
      list.append(label("RECENT", "sm-group"))
      recent.forEach(s => list.append(sessionCard(s)))
    }
    if (before.length) {
      const open = showBefore || !!query // a search looks inside them too
      const toggle = button(`${open ? "▾" : "▸"} Safety snapshots (${before.length})`, "sm-flat")
      toggle.connect("clicked", () => {
        showBefore = !showBefore
        render()
      })
      list.append(toggle)
      if (open) before.forEach(s => list.append(sessionCard(s)))
    }
    list.set_sensitive(!working)
  }

  async function refresh() {
    try {
      sessions = await listSessions()
    } catch (e) {
      status(`Could not list sessions: ${reason(e)}`, "error")
    }
    render()
  }

  search.connect("search-changed", () => {
    query = search.get_text().trim().toLowerCase()
    render()
  })

  refresh()
  return { widget: root, refresh }
}
