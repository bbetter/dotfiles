import Hyprland from "gi://AstalHyprland"
import { Gtk, Gdk } from "ags/gtk4"

export function Workspaces({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const hypr = Hyprland.get_default()
  if (!hypr) return <box class="workspaces" />

  const box = <box spacing={4} class="workspaces" /> as Gtk.Box
  const connector = gdkmonitor.get_connector() ?? ""

  const buttons = new Map<number, Gtk.Button>()
  const iconBoxes = new Map<number, Gtk.Box>()

  const getIconName = (className: string) => {
    const lower = className.toLowerCase()
    if (lower.includes("firefox")) return "firefox"
    if (lower.includes("code")) return "visual-studio-code"
    if (lower.includes("telegram")) return "telegram"
    if (lower.includes("spotify")) return "spotify"
    if (lower.includes("terminal") || lower.includes("foot") || lower.includes("kitty")) return "terminal"
    return lower
  }

  const updateIcons = (id: number) => {
    const iconBox = iconBoxes.get(id)
    if (!iconBox) return

    // Clear icons
    let child = iconBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      iconBox.remove(child)
      child = next
    }

    const clients = hypr.get_clients().filter(c => c.workspace && c.workspace.id === id)
    const seen = new Set<string>()

    for (const client of clients) {
      if (!client.class || seen.has(client.class)) continue
      seen.add(client.class)

      const img = new Gtk.Image({
        iconName: getIconName(client.class),
        pixelSize: 14
      })
      iconBox.append(img)
    }
  }

  const update = () => {
    const activeId = hypr.focusedWorkspace?.id ?? -1

    // Workspaces for this monitor
    const ids = hypr.get_workspaces()
      .filter(ws => ws.id > 0 && ws.monitor && ws.monitor.name === connector)
      .map(ws => ws.id)
      .sort((a, b) => a - b)

    // Ensure active workspace is shown if it belongs here
    if (activeId > 0 && !ids.includes(activeId)) {
      const activeWs = hypr.get_workspaces().find(ws => ws.id === activeId)
      if (activeWs && activeWs.monitor && activeWs.monitor.name === connector) {
        ids.push(activeId)
        ids.sort((a, b) => a - b)
      }
    }

    let changed = false

    // Remove buttons for workspaces that no longer exist
    for (const [id, btn] of buttons) {
      if (!ids.includes(id)) {
        box.remove(btn)
        buttons.delete(id)
        iconBoxes.delete(id)
        changed = true
      }
    }

    // Ensure all buttons exist
    ids.forEach(id => {
      if (!buttons.has(id)) {
        const iconBox = new Gtk.Box({ spacing: 4 })
        const btn = (
          <button onClicked={() => hypr.dispatch("workspace", `${id}`)}>
            <box spacing={6}>
              <label label={id === 10 ? "0" : `${id}`} />
              {iconBox}
            </box>
          </button>
        ) as Gtk.Button
        
        buttons.set(id, btn)
        iconBoxes.set(id, iconBox)
        changed = true
      }

      const btn = buttons.get(id)!
      if (id === activeId) btn.add_css_class("active")
      else btn.remove_css_class("active")

      updateIcons(id)

      const clients = hypr.get_clients().filter(c => c.workspace && c.workspace.id === id)
      if (clients.length > 0) btn.add_css_class("occupied")
      else btn.remove_css_class("occupied")
    })

    // Re-order if needed
    if (changed) {
      let child = box.get_first_child()
      while (child) {
        const next = child.get_next_sibling()
        box.remove(child)
        child = next
      }
      ids.forEach(id => {
        const b = buttons.get(id)
        if (b) box.append(b)
      })
    }
  }

  update()
  hypr.connect("notify::focused-workspace", update)
  hypr.connect("notify::workspaces", update)
  hypr.connect("notify::clients", update)
  hypr.connect("workspace-added", update)
  hypr.connect("workspace-removed", update)

  return box
}
