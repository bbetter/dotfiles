import { createPoll } from "ags/time"
import { exec } from "ags/process"
import { Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import { toggleNetworkPopup } from "../NetworkPopup"
import app from "ags/gtk4/app"

interface NetworkState {
  text: string
  tooltip: string
}

export function NetworkIndicator({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const monitorName = gdkmonitor.get_connector() ?? "default"
  const state = createPoll<NetworkState>(
    { text: "🚫", tooltip: "No network connection" },
    5000,
    () => {
      try {
        const raw = exec(`python3 ${GLib.get_home_dir()}/.config/ags/scripts/network.py`).trim()
        const data = JSON.parse(raw) as { text?: string; tooltip?: string }
        return {
          text: data.text ?? "🚫",
          tooltip: data.tooltip ?? "No network connection",
        }
      } catch {
        return { text: "🚫", tooltip: "No network connection" }
      }
    },
  )

  const btn = (
    <button
      class="network"
      tooltipText={state.as(s => s.tooltip)}
      onClicked={() => toggleNetworkPopup(btn)}
    >
      <label label={state.as(s => s.text)} />
    </button>
  ) as Gtk.Button

  // Set up observer after windows are likely created
  setTimeout(() => {
    const winName = `network-popup-${monitorName}`
    const win = app.get_windows().find(w => w.name === winName)
    if (win) {
      win.connect("notify::visible", (w) => {
        if (w.visible) btn.add_css_class("active")
        else btn.remove_css_class("active")
      })
      // initial check
      if (win.visible) btn.add_css_class("active")
    }
  }, 500)

  return btn
}
