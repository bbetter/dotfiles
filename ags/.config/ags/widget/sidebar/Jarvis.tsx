import { createPoll } from "ags/time"
import { exec } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

interface JarvisState {
  text: string
  tooltip: string
  visible: boolean
}

export function SidebarJarvis() {
  const script = `${GLib.get_home_dir()}/.config/ags/scripts/jarvis-status.sh`

  const state = createPoll<JarvisState>(
    { text: "", tooltip: "", visible: false },
    2000,
    () => {
      try {
        const raw = exec(script).trim()
        if (!raw) return { text: "", tooltip: "", visible: false }
        const data = JSON.parse(raw) as { text?: string; tooltip?: string }
        const text = data.text ?? ""
        return { text, tooltip: data.tooltip ?? "", visible: !!text }
      } catch {
        return { text: "", tooltip: "", visible: false }
      }
    }
  )

  return (
    <box orientation={1} spacing={4} class="sidebar-section" visible={state.as(s => s.visible)}>
      <label label="JARVIS" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box orientation={1} spacing={6} class="sidebar-card">
        <label label={state.as(s => s.text)} useMarkup class="sidebar-jarvis" halign={Gtk.Align.START} wrap />
        <label label={state.as(s => s.tooltip)} class="sidebar-muted" halign={Gtk.Align.START} wrap />
      </box>
    </box>
  )
}
