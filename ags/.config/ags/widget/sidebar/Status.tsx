import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

interface StatusState {
  language: string
  date: string
  time: string
  printer: number
  recording: string
}

interface UpdateStatus {
  pacman: number
  aur: number
}

export function SidebarStatus() {
  const scriptsPath = `${GLib.get_home_dir()}/.config/ags/scripts`

  const quickState = createPoll<StatusState>(
    { language: "?", date: "", time: "", printer: 0, recording: "—" },
    2000,
    async () => {
      const now = new Date()

      let language = "?"
      try {
        const output = await execAsync("hyprctl devices -j")
        const devices = JSON.parse(output)
        const keyboard = devices.keyboards?.find((k: any) => k.main) || devices.keyboards?.[0]
        if (keyboard) {
          const l = keyboard.layout.split(",")[keyboard.active_layout_index] || ""
          language = l.includes("us") ? "EN" : l.includes("ua") ? "UA" : l.toUpperCase()
        }
      } catch {}

      let printer = 0
      try {
        const out = (await execAsync("lpstat -o")).trim()
        if (out) printer = out.split("\n").filter(l => l.trim()).length
      } catch {}

      let recording = "—"
      try {
        const out = (await execAsync(`${scriptsPath}/recording-status.sh`)).trim()
        if (out) {
          const data = JSON.parse(out) as { text?: string }
          recording = data.text || "—"
        }
      } catch {}

      return {
        language,
        date: now.toLocaleDateString("uk-UA", { weekday: "long", day: "2-digit", month: "long" }),
        time: now.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }),
        printer,
        recording,
      }
    },
  )

  const updateState = createPoll<UpdateStatus>(
    { pacman: 0, aur: 0 },
    600000,
    async () => {
      try {
        const raw = (await execAsync(`${scriptsPath}/updates.sh`)).trim()
        if (raw) {
          const data = JSON.parse(raw) as { pacman?: number; aur?: number }
          return { pacman: data.pacman ?? 0, aur: data.aur ?? 0 }
        }
      } catch {}
      return { pacman: 0, aur: 0 }
    }
  )

  return (
    <box
      orientation={1}
      spacing={8}
      class="sidebar-card sidebar-hero-card"
      hexpand={false}
      halign={Gtk.Align.FILL}
    >
      <box hexpand={false}>
        <label label={quickState.as(s => s.time)} class="sidebar-time" hexpand halign={Gtk.Align.START} />
        <label label={quickState.as(s => s.language)} class="sidebar-layout-badge" halign={Gtk.Align.END} />
      </box>
      <label label={quickState.as(s => s.date)} class="sidebar-date" halign={Gtk.Align.START} />

      <box class="sidebar-separator" />

      <box spacing={12} class="sidebar-status-row" hexpand={false}>
        <box spacing={4} class="status-indicator updates" visible={updateState.as(s => s.pacman > 0)} hexpand={false}>
          <label label="󰇚" class="status-indicator-icon" />
          <label label={updateState.as(s => `${s.pacman}`)} class="status-indicator-value" />
        </box>
        <box spacing={4} class="status-indicator updates" visible={updateState.as(s => s.aur > 0)} hexpand={false}>
          <label label="󰚰" class="status-indicator-icon" />
          <label label={updateState.as(s => `${s.aur}`)} class="status-indicator-value" />
        </box>
        <box spacing={4} class="status-indicator printer" visible={quickState.as(s => s.printer > 0)} hexpand={false}>
          <label label="󰐪" class="status-indicator-icon" />
          <label label={quickState.as(s => `${s.printer}`)} class="status-indicator-value" />
        </box>
        <box spacing={4} class="status-indicator recording" visible={quickState.as(s => s.recording !== "—")} hexpand={false}>
          <label label="󰐊" class="status-indicator-icon" />
          <label label={quickState.as(s => s.recording)} class="status-indicator-value" />
        </box>
      </box>
    </box>
  )
}
