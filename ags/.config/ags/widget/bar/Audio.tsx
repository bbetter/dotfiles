import { createBinding, createComputed, createExternal } from "gnim"
import { Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Wp from "gi://AstalWp"
import { toggleAudioPopup } from "../AudioPopup"
import { bindActiveClass } from "../utils/popupActiveClass"

// Headphone sink match (case-insensitive, against the AstalWp description).
// AstalWp leaves Endpoint.name null, so the description is the only usable
// field: the Jieli earbuds dongle shows up as "USB Composite Device ...".
// Update if the earbuds/dongle change.
const HEADPHONE_RE = /jieli|usb composite device/i

// Quiet hours: 22:00 → 08:00, wraps midnight.
const QUIET_START_HOUR = 22
const QUIET_END_HOUR = 8

const ICON_HEADPHONES = "󰋋" // nf-md-headphones
const ICON_SPEAKER = "󰓃" // nf-md-speaker
const ICON_MUTED = "󰝟" // nf-md-volume_off

function isQuietHour(d: Date): boolean {
  const h = d.getHours()
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR
}

// Milliseconds until the next 22:00 or 08:00 boundary (today or tomorrow).
function msUntilNextBoundary(now: Date): number {
  const nowMs = now.getTime()
  let best = Infinity
  for (const hour of [QUIET_START_HOUR, QUIET_END_HOUR]) {
    for (const dayOffset of [0, 1]) {
      const d = new Date(now)
      d.setDate(d.getDate() + dayOffset)
      d.setHours(hour, 0, 0, 0)
      if (d.getTime() > nowMs && d.getTime() - nowMs < best) best = d.getTime() - nowMs
    }
  }
  return best
}

// Flips exactly at the 22:00 / 08:00 boundary: one timer per boundary, no polling.
const quietHours = createExternal<boolean>(isQuietHour(new Date()), (set) => {
  let id = 0
  const schedule = () => {
    // +1s slack so the timer never fires just before the boundary.
    id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, msUntilNextBoundary(new Date()) + 1000, () => {
      set(isQuietHour(new Date()))
      schedule()
      return GLib.SOURCE_REMOVE
    })
  }
  schedule()
  return () => {
    if (id) GLib.source_remove(id)
  }
})

export function Audio({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const wp = Wp.get_default()!
  const monitorName = gdkmonitor.get_connector() ?? "default"

  // Nested bindings follow the default speaker across device switches and fire
  // on volume/mute changes — no polling.
  const volume = createBinding(wp.audio, "defaultSpeaker", "volume")
  const mute = createBinding(wp.audio, "defaultSpeaker", "mute")

  const isHeadphoneSink = (ep: Wp.Endpoint | null) =>
    !!ep && HEADPHONE_RE.test(ep.description ?? "")

  // AstalWp fills Endpoint.name/description asynchronously, so reading them once
  // at add/default-change can see null and never update. Re-check on each
  // endpoint's notify::description / notify::name as well. Event-driven, no polling.
  const headphonesConnected = createExternal<boolean>(false, (set) => {
    const audio = wp.audio
    const watched = new Map<Wp.Endpoint, number[]>()
    const refresh = () => {
      const list = audio.get_speakers() ?? []
      for (const ep of list) {
        if (!watched.has(ep)) {
          watched.set(ep, [ep.connect("notify::description", refresh), ep.connect("notify::name", refresh)])
        }
      }
      for (const [ep, ids] of watched) {
        if (!list.includes(ep)) {
          ids.forEach(id => ep.disconnect(id))
          watched.delete(ep)
        }
      }
      set(list.some(ep => isHeadphoneSink(ep)))
    }
    refresh()
    const ids = [audio.connect("speaker-added", refresh), audio.connect("speaker-removed", refresh)]
    return () => {
      ids.forEach(id => audio.disconnect(id))
      for (const [ep, epIds] of watched) epIds.forEach(id => ep.disconnect(id))
    }
  })

  // Is the current default output a headphone sink?
  const outputIsHeadphones = createExternal<boolean>(false, (set) => {
    const audio = wp.audio
    let ep: Wp.Endpoint | null = null
    let epIds: number[] = []
    const refresh = () => set(isHeadphoneSink(ep))
    const track = () => {
      if (ep) epIds.forEach(id => ep!.disconnect(id))
      epIds = []
      ep = audio.get_default_speaker() ?? null
      if (ep) epIds = [ep.connect("notify::description", refresh), ep.connect("notify::name", refresh)]
      refresh()
    }
    track()
    const sig = audio.connect("notify::default-speaker", track)
    return () => {
      audio.disconnect(sig)
      if (ep) epIds.forEach(id => ep!.disconnect(id))
    }
  })

  // Red = quiet hours + headphones plugged in + sound going to speakers instead.
  const leak = createComputed(
    () => quietHours() && headphonesConnected() && !outputIsHeadphones(),
  )

  const state = createComputed(() => {
    const v = volume()
    if (v == null) return { label: "󰕾 N/A", tooltip: "" }
    const pct = Math.round(v * 100)
    const device = outputIsHeadphones() ? "Headphones" : "Speakers"
    const icon = outputIsHeadphones() ? ICON_HEADPHONES : ICON_SPEAKER
    const warn = leak()
      ? "\n⚠ Headphones connected, sound on speakers (quiet hours)"
      : ""
    return {
      label: mute() ? `${icon} ${ICON_MUTED}` : `${icon} ${pct}%`,
      tooltip: `Output: ${device}\nVolume: ${pct}%${warn}`,
    }
  })

  const btn = (
    <button
      class="audio"
      tooltipText={state.as(s => s.tooltip)}
      onClicked={() => toggleAudioPopup(btn)}
    >
      <label label={state.as(s => s.label)} />
    </button>
  ) as Gtk.Button

  leak.subscribe(() => {
    if (leak.peek()) btn.add_css_class("audio-leak")
    else btn.remove_css_class("audio-leak")
  })
  // Apply the initial state too (subscribe does not fire until the first change).
  if (leak.peek()) btn.add_css_class("audio-leak")

  bindActiveClass(btn, "audio-popup", monitorName)

  const scroll = new Gtk.EventControllerScroll({
    flags: Gtk.EventControllerScrollFlags.VERTICAL | Gtk.EventControllerScrollFlags.DISCRETE,
  })

  scroll.connect("scroll", (_controller, _dx, dy) => {
    const speaker = wp?.audio.defaultSpeaker
    if (!speaker) return true
    try {
      if (dy < 0) speaker.volume = Math.min(1.5, speaker.volume + 0.05)
      else if (dy > 0) speaker.volume = Math.max(0, speaker.volume - 0.05)
    } catch { /* ignore */ }
    return true
  })

  btn.add_controller(scroll)

  // Quick mute toggle next to the pill: visible for the whole leak state, so it
  // stays available after muting. Click mutes the default output, click again
  // to unmute.
  const quickMute = new Gtk.Button()
  quickMute.add_css_class("audio-mute-quick")
  quickMute.connect("clicked", () => {
    const speaker = wp.audio.defaultSpeaker
    if (speaker) speaker.set_mute(!speaker.get_mute())
  })

  const applyQuickMute = () => {
    const muted = mute.peek()
    quickMute.set_label(muted ? "󰕾 Unmute" : `${ICON_MUTED} Mute`)
    quickMute.set_tooltip_text(muted ? "Unmute output" : "Mute output now")
  }
  mute.subscribe(applyQuickMute)
  applyQuickMute()

  leak.subscribe(() => {
    quickMute.visible = leak.peek()
  })
  quickMute.visible = leak.peek()

  const group = new Gtk.Box({ spacing: 4 })
  group.append(btn)
  group.append(quickMute)
  return group
}
