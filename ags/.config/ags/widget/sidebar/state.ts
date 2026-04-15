import app from "ags/gtk4/app"
import { exec } from "ags/process"
import { Gdk } from "ags/gtk4"
import { closeAllPopups } from "../PopupManager"

const SIDEBAR_WINDOW_PREFIXES = ["sidebar-window-", "sidebar-backdrop-"]

function isSidebarWindow(name: string | null) {
  if (!name) return false
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

export function openSidebar(onMonitor?: Gdk.Monitor) {
  closeAllPopups()
  const activeConnector = onMonitor?.get_connector() ?? getActiveMonitorConnector()
  console.log(`AGS: Opening sidebar, target monitor: ${activeConnector}`)

  let count = 0
  eachSidebarWindow(win => {
    const name = win.name || ""
    let connector = null
    if (name.startsWith("sidebar-window-")) connector = name.substring("sidebar-window-".length)
    else if (name.startsWith("sidebar-backdrop-")) connector = name.substring("sidebar-backdrop-".length)
    
    const shouldShow = !activeConnector || !connector || connector === activeConnector
    win.visible = shouldShow
    if (shouldShow) count++
  })
  console.log(`AGS: Sidebar visibility set, shown ${count} windows`)
}

export function closeSidebar() {
  eachSidebarWindow(win => {
    win.visible = false
  })
}

export function toggleSidebar(onMonitor?: Gdk.Monitor) {
  if (isSidebarOpen()) closeSidebar()
  else openSidebar(onMonitor)
}
