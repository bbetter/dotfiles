import { createPoll } from "ags/time"
import { exec } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import Wp from "gi://AstalWp"

interface SidebarStatusState {
  audio: string
  network: string
  language: string
  date: string
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
      network: "No network connection",
      language: "unknown",
      date: "",
    },
    1000,
    () => {
      const speaker = wp?.audio.defaultSpeaker
      let audio = "No audio device"
      if (speaker) {
        const vol = Math.round(speaker.volume * 100)
        audio = speaker.mute ? "Muted" : `${vol}% output`
      }

      let network = "No network connection"
      try {
        const raw = exec(`python3 ${GLib.get_home_dir()}/.config/ags/scripts/network.py`).trim()
        const data = JSON.parse(raw) as { text?: string; tooltip?: string }
        network = data.tooltip?.split("\n").slice(0, 2).join(" - ") || data.text || network
      } catch {
        // keep fallback
      }

      const now = new Date()
      const date = now.toLocaleDateString("uk-UA", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      })

      return {
        audio,
        network,
        language: getLanguage(),
        date,
      }
    },
  )

  return (
    <box orientation={1} spacing={10} class="sidebar-card">
      <label label={state.as(s => s.date)} class="sidebar-date" halign={Gtk.Align.START} />
      <box orientation={1} spacing={8}>
        <box class="sidebar-row">
          <label label="AUDIO" class="sidebar-row-label" />
          <label label={state.as(s => s.audio)} class="sidebar-row-value" hexpand halign={Gtk.Align.END} />
        </box>
        <box class="sidebar-row">
          <label label="NETWORK" class="sidebar-row-label" />
          <label label={state.as(s => s.network)} class="sidebar-row-value" hexpand halign={Gtk.Align.END} wrap />
        </box>
        <box class="sidebar-row">
          <label label="LAYOUT" class="sidebar-row-label" />
          <label label={state.as(s => s.language)} class="sidebar-row-value" hexpand halign={Gtk.Align.END} />
        </box>
        <box spacing={8}>
          <button class="sidebar-action sidebar-action-primary" hexpand onClicked={() => launch("pavucontrol")}>
            <box orientation={1} spacing={2}>
              <label label="Audio" class="sidebar-action-title" halign={Gtk.Align.START} />
              <label label="pavucontrol" class="sidebar-action-subtitle" halign={Gtk.Align.START} />
            </box>
          </button>
          <button class="sidebar-action" hexpand onClicked={() => launch("nm-connection-editor")}>
            <box orientation={1} spacing={2}>
              <label label="Network" class="sidebar-action-title" halign={Gtk.Align.START} />
              <label label="connections" class="sidebar-action-subtitle" halign={Gtk.Align.START} />
            </box>
          </button>
          <button class="sidebar-action" hexpand onClicked={() => launch("sh -c 'blueman-manager || blueberry'")}>
            <box orientation={1} spacing={2}>
              <label label="Bluetooth" class="sidebar-action-title" halign={Gtk.Align.START} />
              <label label="device manager" class="sidebar-action-subtitle" halign={Gtk.Align.START} />
            </box>
          </button>
        </box>
      </box>
    </box>
  )
}
