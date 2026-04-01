import { createPoll } from "ags/time"
import { exec } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import Wp from "gi://AstalWp"

interface SidebarStatusState {
  audio: string
  audioLead: string
  network: string
  networkLead: string
  language: string
  date: string
  time: string
}

function launch(command: string) {
  try {
    exec(command)
  } catch {
    // Ignore missing apps.
  }
}

function getLanguage(): string {
  try {
    const output = exec("hyprctl devices -j")
    const devices = JSON.parse(output)
    const keyboard = devices.keyboards?.find((k: { main?: boolean }) => k.main) || devices.keyboards?.[0]
    if (!keyboard) return "unknown"

    const layouts = keyboard.layout.split(",")
    const activeLayout = layouts[keyboard.active_layout_index] ?? ""
    if (activeLayout === "us") return "English (US)"
    if (activeLayout === "ua") return "Ukrainian"
    return activeLayout.toUpperCase()
  } catch {
    return "unknown"
  }
}

export function SidebarStatus() {
  const wp = Wp.get_default()

  const state = createPoll<SidebarStatusState>(
    {
      audio: "No audio device",
      audioLead: "Audio unavailable",
      network: "No network connection",
      networkLead: "Offline",
      language: "unknown",
      date: "",
      time: "",
    },
    1000,
    () => {
      const speaker = wp?.audio.defaultSpeaker
      let audio = "No audio device"
      let audioLead = "Audio unavailable"
      if (speaker) {
        const vol = Math.round(speaker.volume * 100)
        audio = speaker.mute ? "Muted" : `${vol}% output`
        audioLead = speaker.mute ? "Muted right now" : `Speaker at ${vol}%`
      }

      let network = "No network connection"
      let networkLead = "Offline"
      try {
        const raw = exec(`python3 ${GLib.get_home_dir()}/.config/ags/scripts/network.py`).trim()
        const data = JSON.parse(raw) as { text?: string; tooltip?: string }
        network = data.tooltip?.split("\n").slice(0, 2).join(" - ") || data.text || network
        networkLead = data.text ?? networkLead
      } catch {
        // keep fallback
      }

      const now = new Date()
      const date = now.toLocaleDateString("uk-UA", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      })
      const time = now.toLocaleTimeString("uk-UA", {
        hour: "2-digit",
        minute: "2-digit",
      })

      return {
        audio,
        audioLead,
        network,
        networkLead,
        language: getLanguage(),
        date,
        time,
      }
    },
  )

  return (
    <box orientation={1} spacing={10} class="sidebar-card sidebar-hero-card">
      <box class="sidebar-hero-header">
        <box orientation={1} spacing={2}>
          <label label={state.as(s => s.time)} class="sidebar-time" halign={Gtk.Align.START} />
          <label label={state.as(s => s.date)} class="sidebar-date" halign={Gtk.Align.START} />
        </box>
        <label label="Quick settings and live status" class="sidebar-muted sidebar-caption" halign={Gtk.Align.START} />
      </box>
      <box spacing={8} homogeneous class="sidebar-summary-grid">
        <box orientation={1} spacing={2} class="sidebar-mini-card">
          <label label="AUDIO" class="sidebar-row-label" halign={Gtk.Align.START} />
          <label label={state.as(s => s.audioLead)} class="sidebar-summary-title" halign={Gtk.Align.START} />
          <label label={state.as(s => s.audio)} class="sidebar-muted" halign={Gtk.Align.START} />
        </box>
        <box orientation={1} spacing={2} class="sidebar-mini-card">
          <label label="NETWORK" class="sidebar-row-label" halign={Gtk.Align.START} />
          <label label={state.as(s => s.networkLead)} class="sidebar-summary-title" halign={Gtk.Align.START} />
          <label label={state.as(s => s.network)} class="sidebar-muted" halign={Gtk.Align.START} wrap />
        </box>
      </box>
      <box class="sidebar-row">
        <label label="LAYOUT" class="sidebar-row-label" />
        <label label={state.as(s => s.language)} class="sidebar-row-value sidebar-row-value-strong" hexpand halign={Gtk.Align.END} />
      </box>
      <box spacing={8} homogeneous class="sidebar-quick-grid">
        <button class="sidebar-action sidebar-action-primary" hexpand onClicked={() => launch("pavucontrol")}>
          <box orientation={1} spacing={2}>
            <label label="Audio" class="sidebar-action-title" halign={Gtk.Align.START} />
            <label label="Levels and devices" class="sidebar-action-subtitle" halign={Gtk.Align.START} />
          </box>
        </button>
        <button class="sidebar-action" hexpand onClicked={() => launch("nm-connection-editor")}>
          <box orientation={1} spacing={2}>
            <label label="Network" class="sidebar-action-title" halign={Gtk.Align.START} />
            <label label="Connections" class="sidebar-action-subtitle" halign={Gtk.Align.START} />
          </box>
        </button>
        <button class="sidebar-action" hexpand onClicked={() => launch("sh -c 'blueman-manager || blueberry'")}>
          <box orientation={1} spacing={2}>
            <label label="Bluetooth" class="sidebar-action-title" halign={Gtk.Align.START} />
            <label label="Device manager" class="sidebar-action-subtitle" halign={Gtk.Align.START} />
          </box>
        </button>
      </box>
    </box>
  )
}
