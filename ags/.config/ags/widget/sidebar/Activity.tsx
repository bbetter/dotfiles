import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

interface ActivityState {
  printer: string
  recording: string
}

export function SidebarActivity() {
  const scriptsPath = `${GLib.get_home_dir()}/.config/ags/scripts`

  const state = createPoll<ActivityState>(
    { printer: "Idle", recording: "Not recording" },
    1000,
    async () => {
      let printer = "Idle"
      try {
        const output = (await execAsync("lpstat -l -o")).trim()
        if (output) {
          const count = output.split("\n").filter(line => /^\S/.test(line)).length
          printer = count > 0 ? `${count} print job${count > 1 ? "s" : ""}` : "Idle"
        }
      } catch { /* keep fallback */ }

      let recording = "Not recording"
      try {
        const output = (await execAsync(`${scriptsPath}/recording-status.sh`)).trim()
        if (output) {
          const data = JSON.parse(output) as { text?: string }
          if (data.text) recording = data.text
        }
      } catch { /* keep fallback */ }

      return { printer, recording }
    },
  )

  return (
    <box orientation={1} spacing={6} class="sidebar-section">
      <label label="ACTIVITY" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box spacing={8} homogeneous class="sidebar-utility-grid">
        <box orientation={1} spacing={2} class="sidebar-mini-card">
          <label label="PRINT" class="sidebar-row-label" halign={Gtk.Align.START} />
          <label label={state.as(s => s.printer)} class="sidebar-summary-title" halign={Gtk.Align.START} wrap />
        </box>
        <box orientation={1} spacing={2} class="sidebar-mini-card">
          <label label="RECORD" class="sidebar-row-label" halign={Gtk.Align.START} />
          <label label={state.as(s => s.recording)} class="sidebar-summary-title" halign={Gtk.Align.START} wrap />
        </box>
      </box>
    </box>
  )
}
