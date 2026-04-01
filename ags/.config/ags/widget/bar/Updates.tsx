import { createPoll } from "ags/time"
import { exec } from "ags/process"
import GLib from "gi://GLib"

interface UpdatesState {
  text: string
  tooltip: string
  visible: boolean
  critical: boolean
}

interface UpdatesScriptOutput {
  text?: string
  tooltip?: string
  class?: string
}

function getUpdatesState(): UpdatesState {
  try {
    const script = `${GLib.get_home_dir()}/.config/ags/scripts/updates.sh`
    const raw = exec(script).trim()
    if (!raw) return { text: "", tooltip: "", visible: false, critical: false }
    const data = JSON.parse(raw) as UpdatesScriptOutput
    if (!data.text) return { text: "", tooltip: "", visible: false, critical: false }
    return {
      text: data.text,
      tooltip: data.tooltip ?? "",
      visible: true,
      critical: (data.class ?? "").includes("critical"),
    }
  } catch {
    return { text: "", tooltip: "", visible: false, critical: false }
  }
}

export function Updates() {
  const state = createPoll<UpdatesState>(
    { text: "", tooltip: "", visible: false, critical: false },
    300_000, // 5-minute interval — updates check is expensive
    getUpdatesState
  )

  return (
    <button
      class={state.as(s => `updates${s.critical ? " critical" : ""}`)}
      visible={state.as(s => s.visible)}
      tooltipText={state.as(s => s.tooltip)}
    >
      <label label={state.as(s => s.text)} />
    </button>
  )
}
