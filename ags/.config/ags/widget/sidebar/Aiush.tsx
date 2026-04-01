import { createPoll } from "ags/time"
import { exec } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

interface AiushState {
  text: string
  tooltip: string
  visible: boolean
}

function getAiushState(): AiushState {
  try {
    const raw = exec(`python3 ${GLib.get_home_dir()}/.local/lib/aiush/aiush.py --once`).trim()
    if (!raw) return { text: "", tooltip: "", visible: false }
    const data = JSON.parse(raw) as { text?: string; tooltip?: string }
    const text = data.text ?? ""
    return { text, tooltip: data.tooltip ?? "", visible: !!text }
  } catch {
    return { text: "", tooltip: "", visible: false }
  }
}

export function SidebarAiush() {
  const state = createPoll<AiushState>(
    getAiushState(),
    60_000, // 1-minute interval — external API call
    getAiushState,
  )

  return (
    <box orientation={1} spacing={4} class="sidebar-section" visible={state.as(s => s.visible)}>
      <label label="AIUSH" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box orientation={1} spacing={6} class="sidebar-card sidebar-compact-card">
        <label label={state.as(s => s.text)} useMarkup class="sidebar-aiush" halign={Gtk.Align.START} wrap />
        <label label={state.as(s => s.tooltip)} class="sidebar-muted" halign={Gtk.Align.START} wrap />
      </box>
    </box>
  )
}
