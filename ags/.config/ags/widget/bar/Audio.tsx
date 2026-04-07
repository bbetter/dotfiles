import { createPoll } from "ags/time"
import { Gtk } from "ags/gtk4"
import { exec } from "ags/process"
import Wp from "gi://AstalWp"
import { toggleAudioPopup } from "../AudioPopup"

interface AudioState {
  label: string
  tooltip: string
}

export function Audio() {
  const wp = Wp.get_default()

  const state = createPoll<AudioState>({ label: "󰕾 N/A", tooltip: "" }, 150, () => {
    const speaker = wp?.audio.defaultSpeaker
    if (!speaker) return { label: "󰕾 N/A", tooltip: "" }

    if (speaker.mute) {
      return {
        label: "󰝟 Muted",
        tooltip: "Volume: Muted",
      }
    }

    const vol = Math.round(speaker.volume * 100)
    return {
      label: `󰕾 ${vol}%`,
      tooltip: `Volume: ${vol}%`,
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

  const scroll = new Gtk.EventControllerScroll({
    flags: Gtk.EventControllerScrollFlags.VERTICAL | Gtk.EventControllerScrollFlags.DISCRETE,
  })

  scroll.connect("scroll", (_controller, _dx, dy) => {
    try {
      if (dy < 0) exec("pactl set-sink-volume @DEFAULT_SINK@ +5%")
      else if (dy > 0) exec("pactl set-sink-volume @DEFAULT_SINK@ -5%")
    } catch { /* ignore */ }
    return true
  })

  btn.add_controller(scroll)
  return btn
}
