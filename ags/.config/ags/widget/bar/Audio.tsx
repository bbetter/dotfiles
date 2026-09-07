import { createBinding, createComputed } from "gnim"
import { Gtk, Gdk } from "ags/gtk4"
import Wp from "gi://AstalWp"
import { toggleAudioPopup } from "../AudioPopup"
import { bindActiveClass } from "../utils/popupActiveClass"

export function Audio({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const wp = Wp.get_default()!
  const monitorName = gdkmonitor.get_connector() ?? "default"

  // Nested bindings follow the default speaker across device switches and fire
  // on volume/mute changes — no polling.
  const volume = createBinding(wp.audio, "defaultSpeaker", "volume")
  const mute = createBinding(wp.audio, "defaultSpeaker", "mute")

  const state = createComputed(() => {
    const v = volume()
    if (v == null) return { label: "󰕾 N/A", tooltip: "" }
    const pct = Math.round(v * 100)
    return {
      label: mute() ? "󰝟 Muted" : `󰕾 ${pct}%`,
      tooltip: `Volume: ${pct}%`,
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
  return btn
}
