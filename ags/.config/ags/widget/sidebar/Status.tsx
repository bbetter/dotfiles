import { createConnection, createComputed } from "gnim"
import { createPoll } from "ags/time"
import { exec, execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import Hyprland from "gi://AstalHyprland"
import { isSidebarOpen } from "./state"
import { createMinuteClock } from "../utils/minuteClock"

interface ClockText {
  date: string
  time: string
}

interface ActivityState {
  printer: number
  recording: string
}

interface UpdateStatus {
  pacman: number
  aur: number
}

function clockSnapshot(): ClockText {
  const now = new Date()
  return {
    date: now.toLocaleDateString("uk-UA", { weekday: "long", day: "2-digit", month: "long" }),
    time: now.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }),
  }
}

function readLayoutCode(): string {
  try {
    const devices = JSON.parse(exec("hyprctl devices -j"))
    const kb = devices.keyboards?.find((k: any) => k.main) || devices.keyboards?.[0]
    if (kb) {
      const l = kb.layout.split(",")[kb.active_layout_index] || ""
      return l.includes("us") ? "EN" : l.includes("ua") ? "UA" : l.toUpperCase()
    }
  } catch {
    /* keep fallback */
  }
  return "?"
}

export function SidebarStatus() {
  const scriptsPath = `${GLib.get_home_dir()}/.config/ags/scripts`
  const hypr = Hyprland.get_default()

  const clock = createMinuteClock<ClockText>(clockSnapshot)

  // Re-read only on a real layout switch, not on a timer.
  const layout = createConnection(readLayoutCode(), [hypr, "keyboard-layout", () => readLayoutCode()])

  const activity = createPoll<ActivityState>(
    { printer: 0, recording: "—" },
    4000,
    async (prev) => {
      if (!isSidebarOpen()) return prev

      let printer = 0
      try {
        const out = (await execAsync("lpstat -o")).trim()
        if (out) printer = out.split("\n").filter(l => l.trim()).length
      } catch {}

      let recording = "—"
      try {
        const out = (await execAsync(`${scriptsPath}/recording-status.sh`)).trim()
        if (out) recording = (JSON.parse(out) as { text?: string }).text || "—"
      } catch {}

      return { printer, recording }
    },
  )

  const updateState = createPoll<UpdateStatus>(
    { pacman: 0, aur: 0 },
    600000,
    async (prev) => {
      if (!isSidebarOpen()) return prev
      try {
        const raw = (await execAsync(`${scriptsPath}/updates.sh`)).trim()
        if (raw) {
          const data = JSON.parse(raw) as { pacman?: number; aur?: number }
          return { pacman: data.pacman ?? 0, aur: data.aur ?? 0 }
        }
      } catch {}
      return prev
    },
  )

  const anyChip = createComputed(() => {
    const u = updateState()
    const a = activity()
    return u.pacman > 0 || u.aur > 0 || a.printer > 0 || a.recording !== "—"
  })

  return (
    <box
      orientation={1}
      spacing={8}
      class="sidebar-card sidebar-hero-card"
      hexpand={false}
      halign={Gtk.Align.FILL}
    >
      <box hexpand={false}>
        <label label={clock.as(c => c.time)} class="sidebar-time" hexpand halign={Gtk.Align.START} />
        <label label={layout} class="sidebar-layout-badge" halign={Gtk.Align.END} />
      </box>
      <label label={clock.as(c => c.date)} class="sidebar-date" halign={Gtk.Align.START} />

      <box orientation={1} spacing={8} visible={anyChip} hexpand={false}>
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
          <box spacing={4} class="status-indicator printer" visible={activity.as(s => s.printer > 0)} hexpand={false}>
            <label label="󰐪" class="status-indicator-icon" />
            <label label={activity.as(s => `${s.printer}`)} class="status-indicator-value" />
          </box>
          <box spacing={4} class="status-indicator recording" visible={activity.as(s => s.recording !== "—")} hexpand={false}>
            <label label="󰐊" class="status-indicator-icon" />
            <label label={activity.as(s => s.recording)} class="status-indicator-value" />
          </box>
        </box>
      </box>
    </box>
  )
}
