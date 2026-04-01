import { createPoll } from "ags/time"
import { exec } from "ags/process"
import GLib from "gi://GLib"

interface PeripheralsState {
  text: string
  tooltip: string
  visible: boolean
}

function getPeripheralsState(): PeripheralsState {
  try {
    const raw = exec(`python3 ${GLib.get_home_dir()}/.config/ags/scripts/peripherals.py`).trim()
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

export function PeripheralsIndicator() {
  const state = createPoll<PeripheralsState>(
    { text: "", tooltip: "", visible: false },
    5000,
    getPeripheralsState,
  )

  return (
    <button
      class="peripherals"
      visible={state.as(s => s.visible)}
      tooltipMarkup={state.as(s => s.tooltip)}
    >
      <label label={state.as(s => s.text)} useMarkup />
    </button>
  )
}
