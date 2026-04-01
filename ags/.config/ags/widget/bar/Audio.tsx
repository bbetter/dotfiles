import { createPoll } from "ags/time"
import { exec } from "ags/process"
import { Gtk } from "ags/gtk4"
import Wp from "gi://AstalWp"

interface AudioState {
  label: string
  tooltip: string
}

export function Audio() {
  const wp = Wp.get_default()

  const state = createPoll<AudioState>({ label: "🔊 N/A", tooltip: "" }, 150, () => {
    const speaker = wp?.audio.defaultSpeaker
    if (!speaker) return { label: "🔊 N/A", tooltip: "" }

    if (speaker.mute) {
      return {
        label: "󰖁 Muted",
        tooltip: "Volume: Muted\nClick for Pavucontrol\nRight click to unmute",
      }
    }

    const vol = Math.round(speaker.volume * 100)
    return {
      label: `🔊 ${vol}%`,
      tooltip: `Volume: ${vol}%\nClick for Pavucontrol\nRight click to mute`,
    }
  })

  const button = (
    <button
      class="audio"
      tooltipText={state.as(s => s.tooltip)}
      onClicked={() => {
        try {
          exec("pavucontrol")
        } catch {
          // Ignore if unavailable.
        }
      }}
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
    } catch {
      // Ignore failures from missing backends.
    }

    return true
  })

  button.add_controller(scroll)

  return button
}
