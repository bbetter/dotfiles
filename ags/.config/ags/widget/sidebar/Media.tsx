import { createPoll } from "ags/time"
import { exec, execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import Cava from "gi://AstalCava"

interface MediaState {
  title: string
  subtitle: string
  progress: string
  visible: boolean
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const h = Math.floor(s / 3600)
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
  return `${m}:${sec.toString().padStart(2, "0")}`
}

function runPlayerctl(command: string) {
  try {
    exec(`playerctl ${command}`)
  } catch {
    // Ignore if no active player exists.
  }
}

export function SidebarMedia() {
  const cava = Cava.get_default()
  cava.bars = 18
  cava.framerate = 30

  const state = createPoll<MediaState>(
    { title: "", subtitle: "", progress: "", visible: false },
    1000,
    async () => {
      try {
        const status = (await execAsync("playerctl status")).trim()
        if (status !== "Playing" && status !== "Paused") {
          return { title: "", subtitle: "", progress: "", visible: false }
        }

        const title = (await execAsync("playerctl metadata --format '{{title}}'")).trim() || "Unknown title"
        const artist = (await execAsync("playerctl metadata --format '{{artist}}'")).trim() || "Unknown artist"
        const position = parseFloat(await execAsync("playerctl position"))
        const lengthUs = parseInt(await execAsync("playerctl metadata mpris:length"))
        const length = Number.isFinite(lengthUs) ? lengthUs / 1_000_000 : 0
        const icon = status === "Paused" ? "paused" : "playing"

        return {
          title,
          subtitle: `${artist} • ${icon}`,
          progress: length > 0 ? `${formatTime(position)} / ${formatTime(length)}` : "",
          visible: true,
        }
      } catch {
        return { title: "", subtitle: "", progress: "", visible: false }
      }
    },
  )

  const cavaText = createPoll("▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁", 33, () => {
    const values = cava.values
    if (!values || values.length === 0) {
      return "▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁"
    }

    const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
    return values.slice(0, 18).map(val => {
      const index = Math.min(Math.floor(val * chars.length), chars.length - 1)
      return chars[index]
    }).join("")
  })

  return (
    <box orientation={1} spacing={6} class="sidebar-section" visible={state.as(s => s.visible)}>
      <label label="NOW PLAYING" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box orientation={1} spacing={8} class="sidebar-card sidebar-media-card">
        <label label={state.as(s => s.title)} class="sidebar-media-title" halign={Gtk.Align.START} wrap />
        <label label={state.as(s => s.subtitle)} class="sidebar-media-subtitle" halign={Gtk.Align.START} wrap />
        <label label={state.as(s => s.progress)} class="sidebar-media-progress" halign={Gtk.Align.START} />
        <label label={cavaText} class="sidebar-cava" halign={Gtk.Align.START} />
        <box spacing={8}>
          <button class="sidebar-action sidebar-media-action" onClicked={() => runPlayerctl("previous")}>
            <label label="Prev" />
          </button>
          <button class="sidebar-action sidebar-action-primary sidebar-media-action" onClicked={() => runPlayerctl("play-pause")}>
            <label label="Play / Pause" />
          </button>
          <button class="sidebar-action sidebar-media-action" onClicked={() => runPlayerctl("next")}>
            <label label="Next" />
          </button>
        </box>
      </box>
    </box>
  )
}
