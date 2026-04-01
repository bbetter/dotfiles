import Hyprland from "gi://AstalHyprland"
import { Gtk, Gdk } from "ags/gtk4"

export function Workspaces({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const hypr = Hyprland.get_default()
  const box = <box spacing={4} class="workspaces" /> as Gtk.Box

  // connector matches Hyprland monitor name (e.g. "DP-2", "HDMI-A-1")
  const connector = gdkmonitor.get_connector() ?? ""

  const buttons = new Map<number, Gtk.Button>()
  let lastIdsSignature = ""
  let lastActiveId = -1

  const ensureButton = (id: number) => {
    const existing = buttons.get(id)
    if (existing) return existing

    const btn = new Gtk.Button()
    btn.set_child(new Gtk.Label({ label: id === 10 ? "0" : `${id}` }))
    btn.connect("clicked", () => {
      if (lastActiveId !== id) {
        buttons.get(lastActiveId)?.remove_css_class("active")
        btn.add_css_class("active")
        lastActiveId = id
      }
      hypr.dispatch("workspace", `${id}`)
    })

    buttons.set(id, btn)
    return btn
  }

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

    const idsSignature = ids.join(",")
    if (idsSignature !== lastIdsSignature) {
      lastIdsSignature = idsSignature

      for (const [id, btn] of buttons) {
        if (!ids.includes(id)) {
          box.remove(btn)
          buttons.delete(id)
        }
      }

      let child = box.get_first_child()
      while (child) {
        const next = child.get_next_sibling()
        box.remove(child)
        child = next
      }

      ids.forEach(id => {
        box.append(ensureButton(id))
      })
    }

    if (activeId === lastActiveId) return

    buttons.get(lastActiveId)?.remove_css_class("active")
    buttons.get(activeId)?.add_css_class("active")
    lastActiveId = activeId
  }

  update()
  hypr.connect("notify::focused-workspace", update)
  hypr.connect("notify::workspaces", update)
  hypr.connect("workspace-added", update)
  hypr.connect("workspace-removed", update)

  return box
}
