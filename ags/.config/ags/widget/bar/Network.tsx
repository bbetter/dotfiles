import { createPoll } from "ags/time"
import { exec } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { toggleNetworkPopup } from "../NetworkPopup"

interface NetworkState {
  text: string
  tooltip: string
}

export function NetworkIndicator() {
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

  return btn
}
