import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import GdkPixbuf from "gi://GdkPixbuf"
import Mpris from "gi://AstalMpris"
import { sectionRevealer } from "./utils"

function formatTime(seconds: number): string {
  if (seconds < 0) return "0:00"
  const s = Math.floor(seconds)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const h = Math.floor(s / 3600)
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
  return `${m}:${sec.toString().padStart(2, "0")}`
}

export function SidebarMedia() {
  const mpris = Mpris.get_default()

  // Use the sectionRevealer helper to get a revealer, the toggle button and a summary label widget.
  // We'll update these widgets imperatively on a timer instead of using reactive Bindings.
  const { revealer, toggleBtn, summaryLabel } = sectionRevealer(true)

  // Imperative widgets
  const artImage = new Gtk.Image()
  artImage.add_css_class("sidebar-media-art")

  const titleLabel = new Gtk.Label({
    label: "",
    halign: Gtk.Align.START,
    wrap: true,
  })
  titleLabel.add_css_class("sidebar-media-title")
  titleLabel.set_ellipsize(3)

  const artistLabel = new Gtk.Label({ label: "", halign: Gtk.Align.START })
  artistLabel.add_css_class("sidebar-media-subtitle")
  artistLabel.set_ellipsize(3)

  const progressLabel = new Gtk.Label({ label: "", halign: Gtk.Align.END })
  progressLabel.add_css_class("sidebar-media-progress")

  const adj = new Gtk.Adjustment({
    lower: 0,
    upper: 1,
    step_increment: 0.1,
    page_increment: 5,
  })
  const slider = new Gtk.Scale({
    orientation: Gtk.Orientation.HORIZONTAL,
    adjustment: adj,
    draw_value: false,
  })
  slider.add_css_class("sidebar-media-slider")

  let isDragging = false
  // unitMultiplier holds how many raw units correspond to one UI second:
  // 1 = seconds, 1000 = milliseconds, 1e6 = microseconds (typical for MPRIS).
  let unitMultiplier = 1
  const gesture = Gtk.GestureClick.new()
  gesture.connect("pressed", () => {
    isDragging = true
  })
  gesture.connect("released", () => {
    if (isDragging) {
      isDragging = false
      const player = currentPlayer
      if (player) {
        try {
          // adj holds the UI seconds. Convert back to the player's expected raw units using unitMultiplier.
          const newPosSeconds = adj.get_value()
          const target = Math.round(newPosSeconds * unitMultiplier)
          try {
            player.position = target
          } catch {}
        } catch (e) {
          // ignore errors when setting position
        }
      }
    }
  })
  slider.add_controller(gesture)

  // Controls (symbolic icons) with robust fallback
  const makeSymbolicImage = (name: string, size = 16) => {
    try {
      return new Gtk.Image({ icon_name: name, pixel_size: size })
    } catch {
      // fallback to a simple label glyph when the symbolic icon isn't available
      const glyph = name.includes("pause")
        ? "󰏤"
        : name.includes("skip-backward")
          ? "󰒮"
          : name.includes("skip-forward")
            ? "󰒭"
            : "󰐊"
      return new Gtk.Label({ label: glyph }) as unknown as Gtk.Image
    }
  }

  const prevBtn = new Gtk.Button()
  prevBtn.add_css_class("sidebar-media-btn")
  const prevIcon = makeSymbolicImage("media-skip-backward-symbolic", 16)
  prevBtn.set_child(prevIcon)
  prevBtn.connect("clicked", () => currentPlayer?.previous())

  const playBtn = new Gtk.Button()
  playBtn.add_css_class("sidebar-media-btn")
  playBtn.add_css_class("sidebar-media-btn-main")
  const playIcon = makeSymbolicImage("media-playback-start-symbolic", 18)
  playBtn.set_child(playIcon)
  playBtn.connect("clicked", () => currentPlayer?.playPause())

  const nextBtn = new Gtk.Button()
  nextBtn.add_css_class("sidebar-media-btn")
  const nextIcon = makeSymbolicImage("media-skip-forward-symbolic", 16)
  nextBtn.set_child(nextIcon)
  nextBtn.connect("clicked", () => currentPlayer?.next())

  // Placeholder & card
  const placeholder = new Gtk.Box({ spacing: 10, margin_bottom: 6 })
  placeholder.add_css_class("sidebar-notif-actions")
  const phIcon = new Gtk.Label({ label: "󰝚" })
  phIcon.add_css_class("sidebar-action-title")
  phIcon.add_css_class("sidebar-muted")
  const phText = new Gtk.Label({
    label: "No active player",
    hexpand: true,
    halign: Gtk.Align.START,
  })
  phText.add_css_class("sidebar-action-title")
  phText.add_css_class("sidebar-muted")
  placeholder.append(phIcon)
  placeholder.append(phText)

  const mediaCard = new Gtk.Box({ spacing: 12, margin_bottom: 6 })
  mediaCard.add_css_class("sidebar-card")
  mediaCard.add_css_class("sidebar-media-card")

  const mediaInner = new Gtk.Box({ orientation: 1, spacing: 4, hexpand: true })
  mediaInner.append(titleLabel)
  mediaInner.append(artistLabel)

  const progressBox = new Gtk.Box({ orientation: 1 })
  progressBox.add_css_class("sidebar-media-progress-box")
  progressBox.append(slider)
  progressBox.append(progressLabel)

  const controlsBox = new Gtk.Box({ spacing: 12, halign: Gtk.Align.CENTER })
  controlsBox.add_css_class("sidebar-media-controls")
  controlsBox.append(prevBtn)
  controlsBox.append(playBtn)
  controlsBox.append(nextBtn)

  mediaInner.append(progressBox)
  mediaInner.append(controlsBox)

  // Improve vertical alignment and layout of the media card:
  // keep the card aligned to the top, artwork centered vertically and the inner content filling available space.
  try {
    mediaCard.set_valign(Gtk.Align.START)
  } catch {}
  try {
    mediaCard.set_halign(Gtk.Align.FILL)
  } catch {}
  try {
    artImage.set_valign(Gtk.Align.CENTER)
  } catch {}
  try {
    artImage.set_halign(Gtk.Align.START)
  } catch {}

  mediaCard.append(artImage)
  mediaCard.append(mediaInner)

  const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  content.append(placeholder)
  content.append(mediaCard)
  revealer.set_child(content)

  // State
  let currentPlayer: any = null
  let pollId: number | null = null

  function chooseActivePlayer(players: any[]) {
    // Prefer players that are playing/paused and also expose metadata (title or artist),
    // then any player with metadata, then playing/paused, then first available.
    return (
      players.find(
        (p) =>
          (p.playbackStatus === Mpris.PlaybackStatus.PLAYING ||
            p.playbackStatus === Mpris.PlaybackStatus.PAUSED) &&
          (p.title || p.artist),
      ) ||
      players.find((p) => p.title || p.artist) ||
      players.find((p) => p.playbackStatus === Mpris.PlaybackStatus.PLAYING) ||
      players.find((p) => p.playbackStatus === Mpris.PlaybackStatus.PAUSED) ||
      players[0] ||
      null
    )
  }

  function updateOnce() {
    try {
      const players = mpris.players || []
      const player = chooseActivePlayer(players)

      if (!player) {
        // No player: show placeholder
        placeholder.visible = true
        mediaCard.visible = false
        summaryLabel.set_label("")
        currentPlayer = null
        return
      }

      // If the active player changed, reconnect to its notify signals so we get instant updates
      if (currentPlayer !== player) {
        // Disconnect previous player's signals if we stored them
        try {
          if (currentPlayer && (currentPlayer as any).__agsSignalIds) {
            for (const id of (currentPlayer as any).__agsSignalIds) {
              try {
                currentPlayer.disconnect(id)
              } catch {}
            }
          }
        } catch {}

        // Attach notify listeners to the new player for immediate updates
        if (player) {
          const ids: number[] = []
          try {
            ids.push(
              player.connect("notify::position", () => {
                try {
                  updateOnce()
                } catch {}
              }),
            )
          } catch {}
          try {
            ids.push(
              player.connect("notify::length", () => {
                try {
                  updateOnce()
                } catch {}
              }),
            )
          } catch {}
          try {
            ids.push(
              player.connect("notify::playbackStatus", () => {
                try {
                  updateOnce()
                } catch {}
              }),
            )
          } catch {}
          ;(player as any).__agsSignalIds = ids
        }
      }

      currentPlayer = player

      // Visible UI
      placeholder.visible = false
      mediaCard.visible = true

      // Metadata
      const title = player.title ?? ""
      const artist = player.artist ?? ""
      titleLabel.set_text(title)
      artistLabel.set_text(artist)
      summaryLabel.set_label(artist ? `${artist} – ${title}` : title)

      // Artwork — handle file paths, file:// URIs, and data: URIs (base64)
      const cover = player.coverArt ?? ""
      try {
        if (cover && cover.startsWith("data:")) {
          // Data URI — decode base64 payload and write to a temp file, then load a scaled pixbuf
          const comma = cover.indexOf(",")
          if (comma > 0) {
            const meta = cover.slice(5, comma) // after 'data:'
            const isBase64 = meta.includes(";base64")
            const payload = cover.slice(comma + 1)
            if (isBase64 && payload.length > 0) {
              try {
                const bytes = GLib.base64_decode(payload)
                const tmp = `${GLib.get_tmp_dir()}/ags-cover-${Date.now()}.img`
                // write raw bytes to temporary file
                GLib.file_set_contents(tmp, bytes)
                try {
                  const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                    tmp,
                    56,
                    56,
                    true,
                  )
                  artImage.set_from_pixbuf(pb)
                } catch {
                  artImage.set_from_file(tmp)
                }
              } catch {
                artImage.set_from_icon_name("audio-x-generic-symbolic")
              }
            } else {
              artImage.set_from_icon_name("audio-x-generic-symbolic")
            }
          } else {
            artImage.set_from_icon_name("audio-x-generic-symbolic")
          }
        } else if (
          cover &&
          (cover.startsWith("/") || cover.startsWith("file://"))
        ) {
          const path = cover.replace("file://", "")
          try {
            const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(
              path,
              56,
              56,
              true,
            )
            artImage.set_from_pixbuf(pb)
          } catch {
            // fallback to icon if file cannot be loaded/scaled
            artImage.set_from_icon_name("audio-x-generic-symbolic")
          }
        } else {
          artImage.set_from_icon_name("audio-x-generic-symbolic")
        }
      } catch {
        artImage.set_from_icon_name("audio-x-generic-symbolic")
      }

      // Playback status
      const st = player.playbackStatus
      // update the symbolic image used for the play/pause button; replace child if necessary
      const iconName =
        st === Mpris.PlaybackStatus.PLAYING
          ? "media-playback-pause-symbolic"
          : "media-playback-start-symbolic"
      try {
        // Try updating existing image widget if it supports set_from_icon_name
        if (
          (playIcon as any) &&
          typeof (playIcon as any).set_from_icon_name === "function"
        ) {
          ;(playIcon as any).set_from_icon_name(iconName)
          try {
            playBtn.set_child(playIcon)
          } catch {}
        } else {
          const newImg = new Gtk.Image({ icon_name: iconName, pixel_size: 18 })
          playBtn.set_child(newImg)
        }
      } catch {
        // As a final fallback, place a simple label (emoji glyph)
        try {
          playBtn.set_child(
            new Gtk.Label({
              label: st === Mpris.PlaybackStatus.PLAYING ? "󰏤" : "󰐊",
            }),
          )
        } catch {}
      }

      // Position/length
      // Normalize raw units (some players report position/length in microseconds)
      const rawPos =
        typeof player.position === "number" ? Math.max(0, player.position) : 0
      const rawLen =
        typeof player.length === "number" ? Math.max(0, player.length) : 0

      // Determine unit multiplier for this player's position/length.
      // Heuristic thresholds:
      //  - > 1e7 => microseconds (1e6)
      //  - > 1e4 => milliseconds (1e3)
      //  - otherwise => seconds (1)
      if (rawLen > 1e7 || rawPos > 1e7) unitMultiplier = 1e6
      else if (rawLen > 1e4 || rawPos > 1e4) unitMultiplier = 1000
      else unitMultiplier = 1

      // Convert raw units to integer seconds for display and slider range
      const pos = Math.floor(rawPos / unitMultiplier)
      const len = Math.floor(rawLen / unitMultiplier)

      if (!isDragging) {
        if (len > 0) {
          adj.set_upper(len)
          adj.set_value(pos)
        } else {
          adj.set_upper(1)
          adj.set_value(0)
        }
      }

      progressLabel.set_text(
        len > 0 ? `${formatTime(pos)} / ${formatTime(len)}` : "",
      )
    } catch (e) {
      // keep silent and try again next tick
      // console.error("SidebarMedia update error:", e)
    }
  }

  // Start polling at a higher refresh rate (200ms) for smoother seekbar visuals,
  // but we also rely on player notify signals (connected above) for immediate updates.
  pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
    try {
      updateOnce()
    } catch {}
    return true
  })

  // Run one immediate update
  updateOnce()

  // Cleanup when the widget is destroyed: clear the timer
  revealer.connect("unmap", () => {
    if (pollId !== null) {
      GLib.Source.remove(pollId)
      pollId = null
    }
  })

  // Return the JSX box
  return (
    <box orientation={1} spacing={4} class="sidebar-section">
      <box hexpand spacing={6} class="sidebar-section-header">
        <label
          label="NOW PLAYING"
          class="sidebar-section-title"
          hexpand
          halign={Gtk.Align.START}
        />
        {summaryLabel}
        {toggleBtn}
      </box>
      {revealer}
    </box>
  ) as Gtk.Box
}
