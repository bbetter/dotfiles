import { createPoll } from "ags/time"
import { exec } from "ags/process"
import Cava from "gi://AstalCava"

export function MediaGroup() {
  const cava = Cava.get_default()
  cava.bars = 10
  cava.framerate = 30
  
  // === MEDIA PLAYER ===
  const formatTime = (seconds: number): string => {
    const s = Math.floor(seconds)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    }
    return `${m}:${sec.toString().padStart(2, '0')}`
  }
  
  const mediaText = createPoll("", 500, () => {
    try {
      const status = exec("playerctl status").trim()
      if (status !== "Playing" && status !== "Paused") return ""
      
      const position = parseFloat(exec("playerctl position"))
      const lengthUs = parseInt(exec("playerctl metadata mpris:length"))
      const length = lengthUs / 1_000_000
      
      const icon = status === "Paused" ? "⏸" : "▶"
      return `${icon} ${formatTime(position)} / ${formatTime(length)}`
    } catch (e) {
      return ""
    }
  })
  
  const isMediaVisible = createPoll(false, 500, () => {
    try {
      const status = exec("playerctl status").trim()
      return status === "Playing" || status === "Paused"
    } catch (e) {
      return false
    }
  })
  
  const tooltip = createPoll("", 1000, () => {
    try {
      return exec("playerctl metadata --format '{{title}}\n{{artist}}'")
    } catch (e) {
      return ""
    }
  })
  
  // === CAVA ===
  const cavaText = createPoll("▁▁▁▁▁▁▁▁▁▁", 33, () => {
    const values = cava.values
    if (!values || values.length === 0) {
      return "▁▁▁▁▁▁▁▁▁▁"
    }
    
    const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
    return values.slice(0, 10).map(val => {
      const index = Math.min(Math.floor(val * chars.length), chars.length - 1)
      return chars[index]
    }).join('')
  })

  return (
    <box class="media-group" spacing={0} visible={isMediaVisible}>
      <button 
        class="media media-left"
        tooltipText={tooltip}
        onClicked={() => {
          try {
            exec("playerctl play-pause")
          } catch (e) {
            console.error("Failed to toggle playback:", e)
          }
        }}
      >
        <label label={mediaText} />
      </button>
      
      <box class="cava media-right">
        <label label="♪ " />
        <label label={cavaText} />
      </box>
    </box>
  )
}