import Hyprland from "gi://AstalHyprland"
import { Gtk, Gdk } from "ags/gtk4"

export function Workspaces({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const hypr = Hyprland.get_default()
  const box = <box spacing={4} class="workspaces" /> as Gtk.Box

  // connector matches Hyprland monitor name (e.g. "DP-2", "HDMI-A-1")
  const connector = gdkmonitor.get_connector() ?? ""

  let lastSignature = ""

  const update = () => {
    if (!hypr) return

    const activeId = hypr.focusedWorkspace?.id ?? -1

    // Only workspaces assigned to this monitor
    const ids = hypr.get_workspaces()
      .filter(ws => ws.id > 0 && ws.monitor?.name === connector)
      .map(ws => ws.id)
      .sort((a, b) => a - b)

    // Ensure active workspace is included even if temporarily empty
    if (activeId > 0 && !ids.includes(activeId)) {
      const activeWs = hypr.get_workspaces().find(ws => ws.id === activeId)
      if (!activeWs || activeWs.monitor?.name === connector) ids.push(activeId)
      ids.sort((a, b) => a - b)
    }

    const signature = `${activeId}:${ids.join(",")}`
    if (signature === lastSignature) return
    lastSignature = signature

    let child = box.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      box.remove(child)
      child = next
    }

    ids.forEach(id => {
      const btn = new Gtk.Button()
      btn.set_child(new Gtk.Label({ label: id === 10 ? "0" : `${id}` }))
      if (id === activeId) btn.add_css_class("active")
      btn.connect("clicked", () => hypr.dispatch("workspace", `${id}`))
      box.append(btn)
    })
  }

  update()
  setInterval(update, 500)

  return box
}
