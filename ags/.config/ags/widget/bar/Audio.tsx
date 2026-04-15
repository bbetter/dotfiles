import { createPoll } from "ags/time"
import { Gtk } from "ags/gtk4"
import Wp from "gi://AstalWp"
import { toggleAudioPopup } from "../AudioPopup"
import app from "ags/gtk4/app"

interface AudioState {
  label: string
  tooltip: string
  volume: number
  mute: boolean
}

export function Audio() {
  const wp = Wp.get_default()

  const state = createPoll<AudioState>({ label: "󰕾 N/A", tooltip: "", volume: 0, mute: false }, 200, () => {
    const speaker = wp?.audio.defaultSpeaker
    if (!speaker) return { label: "󰕾 N/A", tooltip: "", volume: 0, mute: false }

    const vol = Math.round(speaker.volume * 100)
    return {
      label: speaker.mute ? "󰝟 Muted" : `󰕾 ${vol}%`,
      tooltip: `Volume: ${vol}%`,
      volume: speaker.volume,
      mute: speaker.mute
    }
  })

  const btn = (
    <button
      class="audio"
      tooltipText={state.as(s => s.tooltip)}
      onClicked={() => toggleAudioPopup(btn)}
    >
      <label label={state.as(s => s.label)} />
    </button>
  ) as Gtk.Button

  app.observe_property("windows", (a) => {
    const win = a.get_window("audio-popup")
    if (win) {
      win.observe_property("visible", (w) => {
        if (w.visible) btn.add_css_class("active")
        else btn.remove_css_class("active")
      })
    }
  })

  const scroll = new Gtk.EventControllerScroll({
    flags: Gtk.EventControllerScrollFlags.VERTICAL | Gtk.EventControllerScrollFlags.DISCRETE,
  })

  scroll.connect("scroll", (_controller, _dx, dy) => {
    const speaker = wp?.audio.defaultSpeaker
    if (!speaker) return true
    try {
      if (dy < 0) speaker.volume = Math.min(1.5, speaker.volume + 0.05)
      else if (dy > 0) speaker.volume = Math.max(0, speaker.volume - 0.05)
    } catch { /* ignore */ }
    return true
  })

  btn.add_controller(scroll)
  return btn
}
