import { createBinding } from "gnim"
import { Gtk } from "ags/gtk4"
import Wp from "gi://AstalWp"

type EndpointKey = "defaultSpeaker" | "defaultMicrophone"

function VolumeRow(audio: any, key: EndpointKey, iconOn: string, iconMuted: string) {
  const volB = createBinding(audio, key, "volume")
  const muteB = createBinding(audio, key, "mute")

  const adj = new Gtk.Adjustment({ lower: 0, upper: 1, step_increment: 0.05, page_increment: 0.1 })
  const scale = new Gtk.Scale({ adjustment: adj, hexpand: true, draw_value: false })
  scale.add_css_class("sidebar-audio-slider")

  let syncing = false
  const syncFromWp = () => {
    syncing = true
    adj.value = Math.min(1, Math.max(0, volB() ?? 0))
    syncing = false
  }
  syncFromWp()
  volB.subscribe(syncFromWp)

  adj.connect("value-changed", () => {
    if (syncing) return
    const ep = audio[key]
    if (ep) {
      try {
        ep.volume = adj.value
      } catch {
        /* endpoint went away */
      }
    }
  })

  const icon = new Gtk.Label({ label: muteB() ? iconMuted : iconOn })
  icon.add_css_class("sidebar-audio-icon")
  muteB.subscribe(() => {
    icon.label = muteB() ? iconMuted : iconOn
  })

  const muteBtn = (<button class="sidebar-audio-mute">{icon}</button>) as Gtk.Button
  muteBtn.connect("clicked", () => {
    const ep = audio[key]
    if (ep) {
      try {
        ep.mute = !ep.mute
      } catch {
        /* endpoint went away */
      }
    }
  })

  const pct = new Gtk.Label({ label: `${Math.round((volB() ?? 0) * 100)}%` })
  pct.add_css_class("sidebar-row-value")
  volB.subscribe(() => {
    pct.label = `${Math.round((volB() ?? 0) * 100)}%`
  })

  return (
    <box spacing={8}>
      {muteBtn}
      {scale}
      {pct}
    </box>
  )
}

export function SidebarAudio() {
  const wp = Wp.get_default()
  if (!wp) return (<box visible={false} />) as Gtk.Box

  return (
    <box orientation={1} spacing={8} class="sidebar-section">
      <label label="AUDIO" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box orientation={1} spacing={10} class="sidebar-card sidebar-compact-card">
        {VolumeRow(wp.audio, "defaultSpeaker", "󰕾", "󰝟")}
        {VolumeRow(wp.audio, "defaultMicrophone", "󰍬", "󰍭")}
      </box>
    </box>
  )
}
