import { createPoll } from "ags/time"
import { exec } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

interface ActivityState {
  printer: string
  recording: string
  visible: boolean
}

export function SidebarActivity() {
  const scriptsPath = `${GLib.get_home_dir()}/.config/ags/scripts`

  const state = createPoll<ActivityState>(
    { printer: "Idle", recording: "Not recording", visible: true },
    1000,
    () => {
      let printer = "Idle"
      try {
        const output = exec("lpstat -l -o").trim()
        if (output) {
          const count = output.split("\n").filter(line => /^\S/.test(line)).length
          printer = count > 0 ? `${count} print job${count > 1 ? "s" : ""}` : "Idle"
        }
      } catch {
        // keep fallback
      }

      let recording = "Not recording"
      try {
        const output = exec(`${scriptsPath}/recording-status.sh`).trim()
        if (output) {
          const data = JSON.parse(output) as { text?: string }
          if (data.text) recording = data.text
        }
      } catch {
        // keep fallback
      }

      return { printer, recording, visible: true }
    },
  )

  return (
    <box orientation={1} spacing={6} class="sidebar-section" visible={state.as(s => s.visible)}>
      <label label="ACTIVITY" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box orientation={1} spacing={8} class="sidebar-card">
        <box class="sidebar-row">
          <label label="PRINT" class="sidebar-row-label" />
          <label label={state.as(s => s.printer)} class="sidebar-row-value" hexpand halign={Gtk.Align.END} />
        </box>
        <box class="sidebar-row">
          <label label="RECORD" class="sidebar-row-label" />
          <label label={state.as(s => s.recording)} class="sidebar-row-value" hexpand halign={Gtk.Align.END} />
        </box>
      </box>
    </box>
  )
}
