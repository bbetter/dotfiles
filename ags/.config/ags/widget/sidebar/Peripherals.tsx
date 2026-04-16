import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { sectionRevealer } from "./utils"

interface PeripheralsState {
  text: string
  tooltip: string
  visible: boolean
}

export function SidebarPeripherals() {
  const script = `${GLib.get_home_dir()}/.config/ags/scripts/peripherals.py`

  const state = createPoll<PeripheralsState>(
    { text: "No devices", tooltip: "", visible: true },
    2000,
    async () => {
      try {
        const raw = (await execAsync(`python3 ${script}`)).trim()
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

  const { revealer, toggleBtn, summaryLabel } = sectionRevealer(true)

  state.subscribe(() => {
    const s = state.peek()
    // First line only, strip markup tags for summary
    summaryLabel.label = s.text.split("\n")[0].replace(/<[^>]+>/g, "").trim()
  })

  const content = (
    <box orientation={1} spacing={6} class="sidebar-card sidebar-compact-card" marginBottom={6}>
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
  ) as Gtk.Box

  revealer.set_child(content)

  return (
    <box orientation={1} spacing={4} class="sidebar-section">
      <box hexpand spacing={6} class="sidebar-section-header">
        <label
          label="DEVICES"
          class="sidebar-section-title"
          hexpand
          halign={Gtk.Align.START}
        />
        {summaryLabel}
        {toggleBtn}
      </box>
      {revealer}
    </box>
  )
}
