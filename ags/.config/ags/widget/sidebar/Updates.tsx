import { createPoll } from "ags/time"
import { exec } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

interface UpdatesState {
  text: string
  tooltip: string
  visible: boolean
}

export function SidebarUpdates() {
  const state = createPoll<UpdatesState>(
    { text: "", tooltip: "", visible: false },
    300_000,
    () => {
      try {
        const raw = exec(`${GLib.get_home_dir()}/.config/ags/scripts/updates.sh`).trim()
        if (!raw) return { text: "", tooltip: "", visible: false }
        const data = JSON.parse(raw) as { text?: string; tooltip?: string }
        if (!data.text) return { text: "", tooltip: "", visible: false }
        return {
          text: data.text,
          tooltip: data.tooltip ?? "",
          visible: true,
        }
      } catch {
        return { text: "", tooltip: "", visible: false }
      }
    },
  )

  return (
    <box orientation={1} spacing={6} class="sidebar-section" visible={state.as(s => s.visible)}>
      <label label="UPDATES" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box orientation={1} spacing={4} class="sidebar-card sidebar-compact-card">
        <label label={state.as(s => s.text)} class="sidebar-updates-text" halign={Gtk.Align.START} />
        <label label={state.as(s => s.tooltip)} class="sidebar-muted" halign={Gtk.Align.START} wrap />
      </box>
    </box>
  )
}
