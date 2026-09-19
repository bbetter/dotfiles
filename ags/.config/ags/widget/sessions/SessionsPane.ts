// Right pane. PERSISTENT sessions (named by you, kept until deleted) on top;
// RECENT ones (autosave, previous session, safety snapshots) below. Any session
// opens the same way; naming a recent one makes it persistent.
import GLib from "gi://GLib"
import { Gdk, Gtk } from "ags/gtk4"
import { appIcon } from "../utils/appIcon"
import {
  DeletedSession,
  OpenMode,
  Plan,
  SmSession,
  deleteSession,
  duplicateSession,
  listSessions,
  listTrash,
  openSessionStream,
  persistSession,
  planSession,
  Prefs,
  UpdateDiff,
  loadPrefs,
  renameSession,
  savePrefs,
  untrashSession,
  updateDiff,
  updateSession,
} from "./api"

export interface SessionsPaneOpts {
  status: (msg: string, kind?: "info" | "error") => void
  busy: (on: boolean) => void
  /** Open the editor for this persistent session, or a new one (null). */
  edit: (stem: string | null) => void
  /** Called after any action finished (the window uses it to refresh the Undo button). */
  onChanged?: () => void
  /** Addresses ticked in the Open Now pane; "Update" then uses only those. */
  getSelected?: () => string[]
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

/** "3 hours ago" from an ISO timestamp. */
function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 2) return "just now"
  if (mins < 120) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  return hours < 48 ? `${hours} hours ago` : `${Math.round(hours / 24)} days ago`
}

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
  const running = s.windows.filter(w => w.running).length
  const ws = [...new Set(s.windows.map(w => w.workspace).filter((x): x is number => x != null))].sort(
    (a, b) => a - b,
  )
  return [
    `${n} window${n === 1 ? "" : "s"}`,
    ws.length ? `workspace ${ws.join(", ")}` : "auto-placed",
    running ? `${running} running` : "",
    s.hotkey ? `⌨ ${s.hotkey}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
}

export function createSessionsPane({ status, busy, edit, onChanged, getSelected }: SessionsPaneOpts) {
  let prefs: Prefs = loadPrefs() // declared first: the hint row below reads it straight away
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
  // What Enter does, and the keys, in one line.
  const hintRow = new Gtk.Box({ spacing: 8 })
  const enterBtn = button("", "sm-flat")
  const paintEnter = () => enterBtn.set_label(`Enter: ${prefs.defaultMode === "replace" ? "Replace" : "Open alongside"}`)
  paintEnter()
  enterBtn.set_tooltip_text("What Enter does on the highlighted session. Click to switch.")
  enterBtn.connect("clicked", () => {
    prefs = { ...prefs, defaultMode: prefs.defaultMode === "replace" ? "alongside" : "replace" }
    savePrefs(prefs)
    paintEnter()
  })
  hintRow.append(enterBtn)
  hintRow.append(label("↑↓ choose · Alt+Enter the other way · Esc clears, then closes", "sm-dim"))
  root.append(hintRow)
  root.append(scroll)

  let sessions: SmSession[] = []
  let expanded: string | null = null
  let confirm: { stem: string; plan: Plan } | null = null
  let deleting: string | null = null
  let naming: { stem: string; mode: NamingMode; text?: string } | null = null
  let query = ""
  let updating: { stem: string; diff: UpdateDiff; ticked: number } | null = null
  let selectedStem: string | null = null
  let cards: { stem: string; widget: Gtk.Widget }[] = []
  let showBefore = false
  let showHistory = false
  let showTrash = false
  let trash: DeletedSession[] = []
  let working = false

  /** A job may return its own final message (e.g. "opened, but 1 window failed"). */
  type Outcome = { msg: string; kind?: "info" | "error" } | string | void

  async function run(what: string, job: () => Promise<Outcome | unknown>, done: string, after?: (out: string) => void) {
    if (working) return
    working = true
    busy(true)
    status(`${what}…`)
    render()
    try {
      const out = await job()
      after?.(typeof out === "string" ? out : "")
      if (out && typeof out === "object" && "msg" in (out as object)) {
        const o = out as { msg: string; kind?: "info" | "error" }
        status(o.msg, o.kind ?? "info")
      } else status(done)
    } catch (e) {
      status(`${what} failed: ${reason(e)}`, "error")
    } finally {
      working = false
      busy(false)
      confirm = null
      await refresh()
      onChanged?.()
    }
  }

  function open(s: SmSession, mode: OpenMode, newCopy = false) {
    run(
      `Opening ${s.name}`,
      async () => {
        const res = await openSessionStream(s.stem, mode, { newCopy }, ev => {
          if (ev.event === "launching") status(`Opening ${s.name}: ${ev.window} (${ev.i} of ${ev.n})…`)
        })
        if (res.failed.length) {
          const names = res.failed.map(f => f.window).join(", ")
          return {
            msg: `Opened ${s.name}, but ${res.failed.length} window${res.failed.length === 1 ? "" : "s"} did not appear: ${names}`,
            kind: "error" as const,
          }
        }
        return { msg: `Opened ${s.name}` }
      },
      `Opened ${s.name}`,
    )
  }

  async function askReplace(s: SmSession) {
    try {
      const plan = await planSession(s.stem, "replace")
      if (!plan.closing.length) return open(s, "replace")
      confirm = { stem: s.stem, plan }
      render()
    } catch (e) {
      status(`Could not work out what would change: ${reason(e)}`, "error")
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

  async function askUpdate(s: SmSession) {
    try {
      const ticked = getSelected?.() ?? []
      const diff = await updateDiff(s.stem, ticked)
      if (diff.unchanged) {
        status(`“${s.name}” already matches what's open: nothing to update.`)
        return
      }
      updating = { stem: s.stem, diff, ticked: ticked.length }
      render()
    } catch (e) {
      status(`Could not work out the update: ${reason(e)}`, "error")
    }
  }

  function updateBox(s: SmSession): Gtk.Widget {
    const d = updating!.diff
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
    box.add_css_class("sm-actions")
    box.add_css_class("confirming")
    box.append(
      label(
        updating!.ticked
          ? `Update from the ${updating!.ticked} ticked window${updating!.ticked === 1 ? "" : "s"}:`
          : "Update from all open windows:",
        "sm-strong",
      ),
    )
    if (d.added.length) box.append(label(`+ adds ${d.added.join(", ")}`, "sm-dim"))
    if (d.removed.length) box.append(label(`− removes ${d.removed.join(", ")}`, "sm-warn"))
    for (const c of d.changed) box.append(label(`~ ${c.window}: ${c.what.join(", ")}`, "sm-dim"))
    box.append(label("Your name, hotkey and hand-tuned settings stay. A backup copy is kept.", "sm-dim"))
    const row = new Gtk.Box({ spacing: 8 })
    const cancel = button("Cancel")
    cancel.connect("clicked", () => {
      updating = null
      render()
    })
    const go = button("Update session", "sm-primary")
    go.connect("clicked", () => {
      const ticked = getSelected?.() ?? []
      updating = null
      run(`Updating ${s.name}`, () => updateSession(s.stem, ticked), `Updated “${s.name}”`)
    })
    row.append(cancel)
    row.append(go)
    box.append(row)
    return box
  }

  function actions(s: SmSession): Gtk.Widget {
    if (naming?.stem === s.stem) return namingRow(s, naming.mode)
    if (updating?.stem === s.stem) return updateBox(s)

    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    box.add_css_class("sm-actions")

    if (confirm?.stem === s.stem) {
      const p = confirm.plan
      box.add_css_class("confirming")
      box.append(label(`Replace closes ${p.closing.length} window${p.closing.length === 1 ? "" : "s"}:`, "sm-strong"))
      box.append(label(p.closing_head, "sm-dim"))
      box.append(label(`Then opens ${p.launching.length} window${p.launching.length === 1 ? "" : "s"}:`, "sm-strong"))
      const byWs = new Map<number, string[]>()
      for (const w of p.launching) {
        const bits = [w.class, w.tabs ? `${w.tabs} tabs` : "", w.cwd ?? ""].filter(Boolean).join(" ")
        byWs.set(w.workspace, [...(byWs.get(w.workspace) ?? []), bits])
      }
      for (const [ws, items] of [...byWs].sort((a, b) => a[0] - b[0])) {
        box.append(label(`workspace ${ws}: ${items.join(", ")}`, "sm-dim"))
      }
      for (const w of p.warnings) box.append(label(`⚠ ${w}`, "sm-warn"))
      box.append(label("A “Before …” safety snapshot is saved first, and you can undo the Replace afterwards.", "sm-dim"))
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
      const upd = button("Update from open windows…")
      upd.connect("clicked", () => askUpdate(s))
      row.append(editBtn)
      row.append(rename)
      row.append(dup)
      row.append(upd)
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
    if (selectedStem === s.stem) card.add_css_class("kbd")
    cards.push({ stem: s.stem, widget: card })

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
        const dot = label(w.running ? "●" : "○", w.running ? "sm-run-dot" : "sm-dim")
        dot.set_tooltip_text(w.running ? "running now" : "not open")
        r.append(dot)
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
    cards = []
    const shown = query ? sessions.filter(s => matches(s, query)) : sessions
    const persistent = shown.filter(s => s.persistent)
    if (prefs.sort === "recent") {
      persistent.sort((a, b) => (b.last_opened ?? 0) - (a.last_opened ?? 0) || a.name.localeCompare(b.name))
    }
    const recent = shown.filter(s => !s.persistent && s.kind !== "before" && s.kind !== "history")
    const before = shown.filter(s => s.kind === "before")
    const history = shown.filter(s => s.kind === "history")
    const gone = query ? trash.filter(d => d.name.toLowerCase().includes(query)) : trash

    if (query && !shown.length) list.append(label(`No session matches “${query}”.`, "sm-dim", "sm-hint"))
    if (!query || persistent.length) {
      const head = new Gtk.Box({ spacing: 4 })
      const title = label("PERSISTENT", "sm-group")
      title.set_hexpand(true)
      head.append(title)
      for (const [key, text] of [["name", "A–Z"], ["recent", "Recent"]] as const) {
        const b = button(text, "sm-flat", prefs.sort === key ? "sm-on" : "sm-off")
        b.connect("clicked", () => {
          prefs = { ...prefs, sort: key }
          savePrefs(prefs)
          render()
        })
        head.append(b)
      }
      list.append(head)
    }
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
    if (history.length) {
      const open = showHistory || !!query
      const toggle = button(`${open ? "▾" : "▸"} Autosave history (${history.length})`, "sm-flat")
      toggle.connect("clicked", () => {
        showHistory = !showHistory
        render()
      })
      list.append(toggle)
      if (open) history.forEach(s => list.append(sessionCard(s)))
    }
    if (gone.length) {
      const open = showTrash || !!query
      const toggle = button(`${open ? "▾" : "▸"} Recently deleted (${gone.length})`, "sm-flat")
      toggle.connect("clicked", () => {
        showTrash = !showTrash
        render()
      })
      list.append(toggle)
      if (open) {
        for (const d of gone) {
          const row = new Gtk.Box({ spacing: 8 })
          row.add_css_class("sm-session")
          const texts = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1, hexpand: true })
          texts.append(label(d.name, "sm-session-name"))
          texts.append(label(`deleted ${ago(d.deleted_at)}`, "sm-dim"))
          const restore = button("Restore", "sm-primary")
          restore.connect("clicked", () =>
            run(
              `Restoring ${d.name}`,
              () => untrashSession(d.id),
              `Restored “${d.name}”`,
              stem => {
                expanded = stem
              },
            ),
          )
          row.append(texts)
          row.append(restore)
          list.append(row)
        }
      }
    }
    list.set_sensitive(!working)
  }

  async function refresh() {
    try {
      ;[sessions, trash] = await Promise.all([listSessions(), listTrash().catch(() => [] as DeletedSession[])])
    } catch (e) {
      status(`Could not list sessions: ${reason(e)}`, "error")
    }
    render()
  }

  // ── keyboard: type to filter, ↑↓ to choose, Enter to open ──────────────────
  function applyKbd() {
    for (const c of cards) {
      if (c.stem === selectedStem) c.widget.add_css_class("kbd")
      else c.widget.remove_css_class("kbd")
    }
  }

  function scrollTo(w: Gtk.Widget) {
    const adj = scroll.get_vadjustment()
    const [ok, , y] = w.translate_coordinates(list, 0, 0)
    if (!ok) return
    const h = w.get_height()
    if (y < adj.get_value()) adj.set_value(Math.max(0, y - 8))
    else if (y + h > adj.get_value() + adj.get_page_size()) adj.set_value(y + h - adj.get_page_size() + 8)
  }

  function moveSel(delta: number) {
    if (!cards.length) return
    const i = cards.findIndex(c => c.stem === selectedStem)
    const next = i < 0 ? (delta > 0 ? 0 : cards.length - 1) : Math.max(0, Math.min(cards.length - 1, i + delta))
    selectedStem = cards[next].stem
    applyKbd()
    scrollTo(cards[next].widget)
  }

  function activate(alternate: boolean) {
    const s = sessions.find(x => x.stem === selectedStem)
    if (!s || working) return
    expanded = s.stem
    if (s.open) return open(s, "switch")
    const mode = alternate ? (prefs.defaultMode === "replace" ? "alongside" : "replace") : prefs.defaultMode
    if (mode === "alongside") return open(s, "alongside")
    if (confirm?.stem === s.stem) return open(s, "replace") // second Enter confirms the preview
    askReplace(s)
  }

  const keys = new Gtk.EventControllerKey()
  keys.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
  keys.connect("key-pressed", (_c, keyval, _code, state) => {
    if (keyval === Gdk.KEY_Down) return moveSel(1), true
    if (keyval === Gdk.KEY_Up) return moveSel(-1), true
    if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
      return activate((state & Gdk.ModifierType.ALT_MASK) !== 0), true
    }
    if (keyval === Gdk.KEY_Escape && search.get_text()) return search.set_text(""), true
    return false
  })
  search.add_controller(keys)

  search.connect("search-changed", () => {
    query = search.get_text().trim().toLowerCase()
    render()
    // typing then Enter should open the best match, like a launcher
    selectedStem = query && cards.length ? cards[0].stem : null
    applyKbd()
  })

  refresh()
  return {
    widget: root,
    refresh,
    focusSearch: () => search.grab_focus(),
    resetSearch: () => {
      selectedStem = null
      search.set_text("")
    },
  }
}
