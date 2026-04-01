import { createPoll } from "ags/time"
import { exec } from "ags/process"
import GLib from "gi://GLib"

interface JarvisState {
  text: string
  tooltip: string
  visible: boolean
}

function getJarvisState(): JarvisState {
  try {
    const raw = exec(`${GLib.get_home_dir()}/.config/ags/scripts/jarvis-status.sh`).trim()
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

export function JarvisIndicator() {
  const state = createPoll<JarvisState>(
    { text: "", tooltip: "", visible: false },
    2000,
    getJarvisState,
  )

  return (
    <button
      class="jarvis"
      visible={state.as(s => s.visible)}
      tooltipText={state.as(s => s.tooltip)}
      onClicked={() => {
        try {
          exec("pkill -SIGUSR1 -f 'python main.py'")
        } catch {
          // Keep the bar responsive if the process is absent.
        }
      }}
    >
      <label label={state.as(s => s.text)} />
    </button>
  )
}
