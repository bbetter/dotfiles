import app from "ags/gtk4/app"
import { exec } from "ags/process"
import { Gdk } from "ags/gtk4"
import { closeAllPopups } from "../PopupManager"

const WINDOW_PREFIX = "sidebar-window-"
const BACKDROP_PREFIX = "sidebar-backdrop-"

// Keep in sync with the Gtk.Revealer transition_duration in Sidebar.tsx.
const SLIDE_MS = 260

type RevealFn = (shown: boolean) => void
const revealers = new Map<string, RevealFn>()
const openListeners = new Set<() => void>()

let openState = false
let closeTimer = 0

/** Sidebar.tsx registers its slide-revealer control, keyed by monitor connector. */
export function registerSidebar(connector: string, reveal: RevealFn) {
  revealers.set(connector, reveal)
}

/** Run `cb` every time the drawer is opened (e.g. to force a stale poll to refresh). */
export function onSidebarOpen(cb: () => void): () => void {
  openListeners.add(cb)
  return () => openListeners.delete(cb)
}

/** Intent-based: flips false the instant a close starts, before the slide-out finishes. */
export function isSidebarOpen(): boolean {
  return openState
}

function connectorOf(name: string | null, prefix: string): string | null {
  if (!name || !name.startsWith(prefix)) return null
  return name.substring(prefix.length)
}

function getActiveMonitorConnector(): string | null {
  try {
    const monitors = JSON.parse(exec("hyprctl monitors -j")) as Array<{ name?: string; focused?: boolean }>
    return monitors.find(monitor => monitor.focused)?.name ?? null
  } catch {
    return null
  }
}

export function openSidebar(onMonitor?: Gdk.Monitor) {
  closeAllPopups()
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = 0
  }

  const active = onMonitor?.get_connector() ?? getActiveMonitorConnector()
  openState = true

  for (const win of app.get_windows()) {
    const drawer = connectorOf(win.name, WINDOW_PREFIX)
    const backdrop = connectorOf(win.name, BACKDROP_PREFIX)
    const connector = drawer ?? backdrop
    if (connector === null) continue

    const show = !active || connector === active

    if (drawer !== null) {
      if (show) {
        win.visible = true
        revealers.get(connector)?.(true)
      } else {
        revealers.get(connector)?.(false)
        win.visible = false
      }
    } else {
      win.visible = show
    }
  }

  openListeners.forEach(cb => {
    try {
      cb()
    } catch {
      /* a listener throwing must not break the open */
    }
  })
}

export function closeSidebar() {
  openState = false

  const drawers: Array<ReturnType<typeof app.get_windows>[number]> = []
  for (const win of app.get_windows()) {
    const drawer = connectorOf(win.name, WINDOW_PREFIX)
    const backdrop = connectorOf(win.name, BACKDROP_PREFIX)
    if (backdrop !== null) {
      win.visible = false
      continue
    }
    if (drawer !== null && win.visible) {
      revealers.get(drawer)?.(false)
      drawers.push(win)
    }
  }

  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    drawers.forEach(win => {
      win.visible = false
    })
    closeTimer = 0
  }, SLIDE_MS)
}

export function toggleSidebar(onMonitor?: Gdk.Monitor) {
  if (isSidebarOpen()) closeSidebar()
  else openSidebar(onMonitor)
}
