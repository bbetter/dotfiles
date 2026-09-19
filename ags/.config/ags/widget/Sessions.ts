// hypr-sm session manager: a normal (floating) toplevel window, toggled with
// SUPER+N via `ags request sessions`. Persistent: it stays until you close it.
import app from "ags/gtk4/app"
import Hyprland from "gi://AstalHyprland"
import GLib from "gi://GLib"
import { Gtk, Gdk } from "ags/gtk4"
import { createNowPane } from "./sessions/NowPane"
import { createSessionsPane } from "./sessions/SessionsPane"
import { WINDOW_TITLE, focusWindow, moveWindow, saveSession } from "./sessions/api"

let win: Gtk.Window | null = null
let refreshAll: () => void = () => {}

function build(): Gtk.Window {
  const hypr = Hyprland.get_default()
  const selected = new Set<string>()

  const win = new Gtk.Window({
    title: WINDOW_TITLE,
    defaultWidth: 1180,
    defaultHeight: 760,
    decorated: false,
    application: app,
  })
  win.add_css_class("SessionsWindow")

  // ── status bar ──────────────────────────────────────────────────────────
  const statusLabel = new Gtk.Label({ label: "", xalign: 0, hexpand: true, ellipsize: 3, maxWidthChars: 1 })
  const spinner = new Gtk.Spinner()
  let statusTimer = 0
  const status = (msg: string, kind: "info" | "error" = "info") => {
    statusLabel.set_label(msg)
    statusLabel.remove_css_class("error")
    if (kind === "error") statusLabel.add_css_class("error")
    if (statusTimer) GLib.source_remove(statusTimer)
    statusTimer = kind === "error" || !msg ? 0 : GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
      statusTimer = 0
      statusLabel.set_label("")
      return false
    })
  }
  const busy = (on: boolean) => {
    spinner.set_spinning(on)
    spinner.set_visible(on)
  }
  spinner.set_visible(false)

  const now = createNowPane({
    selected,
    status,
    save: (name, addrs, asTemplate) => {
      saveSession(name, addrs, asTemplate)
        .then(out => {
          const skipped = out.split("\n").filter(l => l.includes("skipped")).map(l => l.trim())
          status(
            `${asTemplate ? "Template" : "Session"} “${name}” saved` +
              (skipped.length ? ` (${skipped.join("; ")})` : ""),
          )
          sessions.refresh()
        })
        .catch(e => status(`Save failed: ${String(e).trim().split("\n").pop()}`, "error"))
    },
  })
  const sessions = createSessionsPane({ status, busy })

  // ── layout ──────────────────────────────────────────────────────────────
  const title = new Gtk.Label({ label: "Sessions", xalign: 0, hexpand: true })
  title.add_css_class("sm-title")
  const close = new Gtk.Button({ label: "󰅖" })
  close.add_css_class("sm-close")
  close.connect("clicked", () => win.hide())
  const headerBox = new Gtk.Box({ spacing: 8 })
  headerBox.add_css_class("sm-header")
  headerBox.append(title)
  headerBox.append(close)
  const header = new Gtk.WindowHandle({ child: headerBox }) // drag to move

  const nowFrame = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, hexpand: true, vexpand: true })
  const nowTitle = new Gtk.Label({ label: "OPEN NOW", xalign: 0 })
  nowTitle.add_css_class("sm-group")
  nowFrame.append(nowTitle)
  nowFrame.append(now.widget)

  const right = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8, widthRequest: 400 })
  right.add_css_class("sm-right")
  const sessionsTitle = new Gtk.Label({ label: "SESSIONS & TEMPLATES", xalign: 0 })
  sessionsTitle.add_css_class("sm-group")
  right.append(sessionsTitle)
  right.append(sessions.widget)

  const body = new Gtk.Box({ spacing: 16 })
  body.add_css_class("sm-body")
  body.append(nowFrame)
  body.append(right)

  const bar = new Gtk.Box({ spacing: 8 })
  bar.add_css_class("sm-status")
  bar.append(spinner)
  bar.append(statusLabel)

  const outer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  outer.add_css_class("sm-window")
  outer.append(header)
  outer.append(body)
  outer.append(bar)
  win.set_child(outer)

  // Esc hides (the window is otherwise persistent).
  const keys = new Gtk.EventControllerKey()
  keys.connect("key-pressed", (_c, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      win.hide()
      return true
    }
    return false
  })
  win.add_controller(keys)

  // ── live updates ────────────────────────────────────────────────────────
  let sessionsTimer = 0
  const changed = () => {
    if (!win.visible) return
    now.refresh()
    if (sessionsTimer) return
    sessionsTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
      sessionsTimer = 0
      if (win.visible) sessions.refresh() // "open" flags follow windows closing
      return false
    })
  }
  for (const sig of ["notify::clients", "notify::workspaces", "notify::monitors", "notify::focused-workspace"])
    hypr.connect(sig, changed)
  hypr.connect("event", (_h: any, name: string) => {
    if (name === "windowtitlev2" || name === "windowtitle") now.refresh()
  })

  refreshAll = () => {
    now.refresh()
    sessions.refresh()
  }
  win.connect("notify::visible", () => {
    if (win.visible) refreshAll()
  })
  // Templates edited by hand / saved elsewhere show up when you come back to the window.
  win.connect("notify::is-active", () => {
    if (win.is_active) sessions.refresh()
  })
  return win
}

/** SUPER+N. Open on the workspace you are on; if already there: focus it, or hide when it has focus. */
export function toggleSessions(action: string = "toggle") {
  win ??= build()
  const hypr = Hyprland.get_default()
  const client = hypr.get_clients().find(c => c.title === WINDOW_TITLE)

  if (action === "close") return win.hide()

  if (!win.visible || !client) {
    win.present()
    return
  }
  const here = hypr.focusedWorkspace?.id
  if (client.workspace?.id !== here && here != null) {
    // Left open on another workspace: bring it to you instead of switching away.
    moveWindow(client.address, here).then(() => focusWindow(client.address)).catch(() => {})
    return
  }
  if (action === "toggle" && win.is_active) win.hide()
  else focusWindow(client.address).catch(() => win!.present()) // present() alone won't steal focus
}
