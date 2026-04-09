import { Gtk } from "ags/gtk4"
import Mpris from "gi://AstalMpris"
import Cava from "gi://AstalCava"
import { Binding } from "ags"

export function MediaGroup() {
  const mpris = Mpris.get_default()
  const cava = Cava.get_default()
  
  cava.bars = 10
  cava.framerate = 30
  
  const formatTime = (seconds: number): string => {
    if (seconds < 0) return "0:00"
    const s = Math.floor(seconds)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    }
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Get the player that is currently playing, or the first one
  const activePlayer = Binding.derive([mpris.bind("players")], (players) => {
    return players.find(p => p.playbackStatus === Mpris.PlaybackStatus.PLAYING) || players[0] || null
  })

  // We'll use a Box that updates its content based on the active player
  const content = new Gtk.Box()
  
  const updateContent = (player: Mpris.Player | null) => {
    // Clear
    let child = content.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      content.remove(child)
      child = next
    }

    if (!player) return

    const label = new Gtk.Label()
    const updateLabel = () => {
      const status = player.playbackStatus === Mpris.PlaybackStatus.PAUSED ? "⏸" : "▶"
      const current = player.position < 0 ? 0 : player.position
      const total = player.length < 0 ? 0 : player.length
      label.label = `${status} ${formatTime(current)} / ${formatTime(total)}`
    }

    player.connect("notify::playback-status", updateLabel)
    player.connect("notify::position", updateLabel)
    player.connect("notify::length", updateLabel)
    updateLabel()
    
    content.append(label)
  }

  activePlayer.subscribe(updateContent)
  updateContent(mpris.players.find(p => p.playbackStatus === Mpris.PlaybackStatus.PLAYING) || mpris.players[0] || null)

  // === CAVA ===
  const cavaText = cava.bind("values").as(values => {
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
    <box class="media-group" spacing={0} visible={mpris.bind("players").as(p => p.length > 0)}>
      <button 
        class="media media-left"
        onClicked={() => {
          const p = mpris.players.find(p => p.playbackStatus === Mpris.PlaybackStatus.PLAYING) || mpris.players[0]
          p?.playPause()
        }}
      >
        {content}
      </button>
      
      <box class="cava media-right">
        <label label="♪ " />
        <label label={cavaText} />
      </box>
    </box>
  )
}
