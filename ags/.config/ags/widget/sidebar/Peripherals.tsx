import { createPoll } from "ags/time"
import { exec } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

interface PeripheralsState {
  text: string
  tooltip: string
  visible: boolean
}

export function SidebarPeripherals() {
  const script = `${GLib.get_home_dir()}/.config/ags/scripts/peripherals.py`

  const state = createPoll<PeripheralsState>(
    { text: "No devices", tooltip: "", visible: true },
    5000,
    () => {
      try {
        const raw = exec(`python3 ${script}`).trim()
        if (!raw) return { text: "No devices", tooltip: "", visible: true }
        const data = JSON.parse(raw) as { text?: string; tooltip?: string }
        return {
          text: data.text ?? "No devices",
          tooltip: data.tooltip ?? "",
          visible: true,
        }
      } catch {
        return { text: "No devices", tooltip: "", visible: true }
      }
    }
  )

  return (
    <box orientation={1} spacing={4} class="sidebar-section">
      <label label="DEVICES" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box orientation={1} spacing={6} class="sidebar-card sidebar-compact-card">
        <label
          label={state.as(s => s.text)}
          useMarkup
          class="sidebar-peripherals"
          halign={Gtk.Align.START}
          wrap
        />
        <label
          label={state.as(s => s.tooltip)}
          class="sidebar-muted"
          halign={Gtk.Align.START}
          wrap
        />
      </box>
    </box>
  )
}
