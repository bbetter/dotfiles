import app from "ags/gtk4/app"
import { exec } from "ags/process"
import { closeAllPopups } from "../PopupManager"

const SIDEBAR_WINDOW_PREFIXES = ["sidebar-window-", "sidebar-backdrop-"]

function isSidebarWindow(name: string) {
  return SIDEBAR_WINDOW_PREFIXES.some(prefix => name.startsWith(prefix))
}

function eachSidebarWindow(fn: (win: ReturnType<typeof app.get_windows>[number]) => void) {
  for (const win of app.get_windows()) {
    if (isSidebarWindow(win.name)) fn(win)
  }
}

function getActiveMonitorConnector(): string | null {
  try {
    const output = exec("hyprctl monitors -j")
    const monitors = JSON.parse(output) as Array<{ name?: string; focused?: boolean }>
    return monitors.find(monitor => monitor.focused)?.name ?? null
  } catch {
    return null
  }
}

export function isSidebarOpen(): boolean {
  return app.get_windows().some(win => isSidebarWindow(win.name) && win.visible)
}

export function openSidebar() {
  closeAllPopups()
  const activeConnector = getActiveMonitorConnector()

  eachSidebarWindow(win => {
    const connector = win.gdkmonitor?.get_connector?.() ?? null
    win.visible = activeConnector ? connector === activeConnector : true
  })
}

export function closeSidebar() {
  eachSidebarWindow(win => {
    win.visible = false
  })
}

export function toggleSidebar() {
  if (isSidebarOpen()) closeSidebar()
  else openSidebar()
}
