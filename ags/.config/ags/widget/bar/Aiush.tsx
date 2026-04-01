import { createPoll } from "ags/time"
import { exec } from "ags/process"
import GLib from "gi://GLib"

interface AiushState {
  text: string
  tooltip: string
  visible: boolean
}

function getAiushState(): AiushState {
  try {
    const raw = exec(`python3 ${GLib.get_home_dir()}/.local/lib/aiush/aiush.py --once`).trim()
    if (!raw) return { text: "", tooltip: "", visible: false }
    const data = JSON.parse(raw) as { text?: string; tooltip?: string }
    const text = data.text ?? ""
    return {
      text,
      tooltip: data.tooltip ?? "",
      visible: !!text,
    }
  } catch {
    return { text: "", tooltip: "", visible: false }
  }
}

export function AiushIndicator() {
  const state = createPoll<AiushState>(
    { text: "", tooltip: "", visible: false },
    60_000,
    getAiushState,
  )

  return (
    <button
      class="aiush"
      visible={state.as(s => s.visible)}
      tooltipText={state.as(s => s.tooltip)}
    >
      <label label={state.as(s => s.text)} />
    </button>
  )
}
