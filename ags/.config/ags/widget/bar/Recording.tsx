import { createPoll } from "ags/time"
import { exec } from "ags/process"
import GLib from "gi://GLib"

interface RecordingState {
  text: string
  visible: boolean
}

export function RecordingStatus() {
  const homeDir = GLib.get_home_dir()
  const scriptsPath = `${homeDir}/.config/ags/scripts`

  const state = createPoll<RecordingState>({ text: "", visible: false }, 1000, () => {
    try {
      const scriptPath = `${scriptsPath}/recording-status.sh`
      const output = exec(scriptPath).trim()

      if (!output) return { text: "", visible: false }

      const data = JSON.parse(output) as { text?: string }
      const text = data.text ?? ""
      return { text, visible: !!text }
    } catch {
      return { text: "", visible: false }
    }
  })

  return (
    <button 
      class="recording"
      visible={state.as(s => s.visible)}
      onClicked={() => {
        try {
          exec(`${scriptsPath}/stop-recording.sh`)
        } catch (error) {
          console.error("Failed to stop recording:", error)
        }
      }}
    >
      <label label={state.as(s => s.text)} />
    </button>
  )
}
