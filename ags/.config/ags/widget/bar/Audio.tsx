import { createPoll } from "ags/time"
import { exec } from "ags/process"
import Wp from "gi://AstalWp"

interface AudioState {
  label: string
  tooltip: string
}

export function Audio() {
  const wp = Wp.get_default()

  const state = createPoll<AudioState>({ label: "🔊 N/A", tooltip: "" }, 500, () => {
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

  return (
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
  )
}
