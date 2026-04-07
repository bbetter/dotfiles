import { exec, execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

interface SystemState {
  count: number
  dnd: boolean
  printer: string
  recording: string
}

export function SidebarNotifications() {
  const scriptsPath = `${GLib.get_home_dir()}/.config/ags/scripts`

  const state = createPoll<SystemState>(
    { count: 0, dnd: false, printer: "Idle", recording: "—" },
    1000,
    async () => {
      let count = 0
      let dnd = false
      try {
        count = Number.parseInt((await execAsync("swaync-client -c -sw")).trim(), 10)
        if (!Number.isFinite(count)) count = 0
        dnd = (await execAsync("swaync-client -D -sw")).trim().toLowerCase() === "true"
      } catch { /* keep fallback */ }

      let printer = "Idle"
      try {
        const out = (await execAsync("lpstat -l -o")).trim()
        if (out) {
          const n = out.split("\n").filter(l => /^\S/.test(l)).length
          printer = n > 0 ? `${n} job${n > 1 ? "s" : ""}` : "Idle"
        }
      } catch { /* keep fallback */ }

      let recording = "—"
      try {
        const out = (await execAsync(`${scriptsPath}/recording-status.sh`)).trim()
        if (out) {
          const data = JSON.parse(out) as { text?: string }
          recording = data.text || "—"
        }
      } catch { /* keep fallback */ }

      return { count, dnd, printer, recording }
    },
  )

  return (
    <box orientation={1} spacing={6} class="sidebar-section">
      <label label="STATUS" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box spacing={6} homogeneous>
        <box orientation={1} spacing={2} class="sidebar-mini-card">
          <label label="ALERTS" class="sidebar-row-label" halign={Gtk.Align.START} />
          <label
            label={state.as(s => `${s.count}`)}
            class={state.as(s => `sidebar-compact-value${s.count > 0 ? " sidebar-attention" : ""}`)}
            halign={Gtk.Align.START}
          />
          <label
            label={state.as(s => s.dnd ? "DND on" : s.count > 0 ? "pending" : "clear")}
            class="sidebar-muted"
            halign={Gtk.Align.START}
          />
        </box>
        <box orientation={1} spacing={2} class="sidebar-mini-card">
          <label label="PRINT" class="sidebar-row-label" halign={Gtk.Align.START} />
          <label label={state.as(s => s.printer)} class="sidebar-compact-value" halign={Gtk.Align.START} />
        </box>
        <box orientation={1} spacing={2} class="sidebar-mini-card">
          <label label="RECORD" class="sidebar-row-label" halign={Gtk.Align.START} />
          <label label={state.as(s => s.recording)} class="sidebar-compact-value" halign={Gtk.Align.START} ellipsize={3} />
        </box>
      </box>
      <box spacing={6} homogeneous>
        <button class="sidebar-action" onClicked={() => { try { exec("swaync-client -op -sw") } catch {} }}>
          <label label="Open" />
        </button>
        <button class="sidebar-action sidebar-action-primary" onClicked={() => { try { exec("swaync-client -C -sw") } catch {} }}>
          <label label="Clear" />
        </button>
        <button class="sidebar-action" onClicked={() => { try { exec("swaync-client -d -sw") } catch {} }}>
          <label label={state.as(s => s.dnd ? "DND off" : "DND on")} />
        </button>
      </box>
    </box>
  )
}
