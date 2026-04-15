import { createPoll } from "ags/time"
import { exec, execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"

interface MediaState {
  title: string
  subtitle: string
  progress: string
  visible: boolean
  artUrl: string
  status: string
  position: number
  length: number
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
  const state = createPoll<MediaState>(
    { title: "", subtitle: "", progress: "", visible: false, artUrl: "", status: "", position: 0, length: 0 },
    1000,
    async () => {
      try {
        const raw = (await execAsync(
          "playerctl metadata --format '{{status}}\\t{{title}}\\t{{artist}}\\t{{position}}\\t{{mpris:length}}\\t{{mpris:artUrl}}'"
        )).trim()

        const [status, title, artist, posStr, lengthStr, artUrl] = raw.split("\t")

        if (status !== "Playing" && status !== "Paused") {
          return { title: "", subtitle: "", progress: "", visible: false, artUrl: "", status: "", position: 0, length: 0 }
        }

        const position = parseFloat(posStr) / 1_000_000 || 0
        const lengthUs = parseInt(lengthStr) || 0
        const length = lengthUs / 1_000_000

        return {
          title: title || "Unknown title",
          subtitle: artist || "Unknown artist",
          progress: length > 0 ? `${formatTime(position)} / ${formatTime(length)}` : "",
          visible: true,
          artUrl: artUrl || "",
          status,
          position,
          length
        }
      } catch {
        return { title: "", subtitle: "", progress: "", visible: false, artUrl: "", status: "", position: 0, length: 0 }
      }
    },
  )

  const adj = new Gtk.Adjustment({ lower: 0, upper: 1, step_increment: 1 })
  const slider = new Gtk.Scale({ 
    orientation: Gtk.Orientation.HORIZONTAL, 
    adjustment: adj,
    draw_value: false
  })
  slider.add_css_class("sidebar-media-slider")

  let isDragging = false
  
  const gesture = Gtk.GestureClick.new()
  gesture.connect("pressed", () => { isDragging = true })
  gesture.connect("released", () => { 
    if (isDragging) {
      isDragging = false
      runPlayerctl(`position ${adj.get_value()}`)
    }
  })
  slider.add_controller(gesture)

  state.subscribe(s => {
    if (!isDragging && s.length > 0) {
      adj.set_upper(s.length)
      adj.set_value(s.position)
    }
  })

  const artImage = new Gtk.Image()
  artImage.add_css_class("sidebar-media-art")
  state.subscribe(s => {
    if (s.artUrl) {
      if (s.artUrl.startsWith("file://")) {
        artImage.set_from_file(s.artUrl.replace("file://", ""))
      } else {
        artImage.set_from_icon_name("audio-x-generic-symbolic")
      }
    } else {
      artImage.set_from_icon_name("audio-x-generic-symbolic")
    }
  })

  return (
    <box orientation={1} spacing={6} class="sidebar-section" visible={state.as(s => s.visible)}>
      <label label="NOW PLAYING" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box spacing={12} class="sidebar-card sidebar-media-card">
        {artImage}
        <box orientation={1} spacing={4} hexpand>
          <label label={state.as(s => s.title)} class="sidebar-media-title" halign={Gtk.Align.START} wrap ellipsize={3} />
          <label label={state.as(s => s.subtitle)} class="sidebar-media-subtitle" halign={Gtk.Align.START} ellipsize={3} />
          
          <box orientation={1} class="sidebar-media-progress-box">
            {slider}
            <label label={state.as(s => s.progress)} class="sidebar-media-progress" halign={Gtk.Align.END} />
          </box>

          <box spacing={12} halign={Gtk.Align.CENTER} class="sidebar-media-controls">
            <button class="sidebar-media-btn" onClicked={() => runPlayerctl("previous")}>
              <label label="󰒮" />
            </button>
            <button class="sidebar-media-btn sidebar-media-btn-main" onClicked={() => runPlayerctl("play-pause")}>
              <label label={state.as(s => s.status === "Playing" ? "󰏤" : "󰐊")} />
            </button>
            <button class="sidebar-media-btn" onClicked={() => runPlayerctl("next")}>
              <label label="󰒭" />
            </button>
          </box>
        </box>
      </box>
    </box>
  )
}
