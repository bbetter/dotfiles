import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import AstalWp from "gi://AstalWp"
import { closeAllPopups, updateBackdrop } from "./PopupManager"
import { closeSidebar } from "./sidebar/state"

// ─────────────────────────────────────────────────────────────────────────────
// Volume slider section — imperative (Gtk.Scale + Gtk.Adjustment)
// ─────────────────────────────────────────────────────────────────────────────

interface SliderSection {
  widget: Gtk.Box
  /** Call when the underlying endpoint changes (e.g. default switched) */
  bind(endpoint: AstalWp.Endpoint | null): void
}

function makeSliderSection(label: string): SliderSection {
  let _endpoint: AstalWp.Endpoint | null = null
  let _volumeSignal = 0
  let _muteSignal = 0
  let _updating = false // prevent feedback loop

  const adj = new Gtk.Adjustment({ lower: 0, upper: 1.5, step_increment: 0.05, page_increment: 0.1 })

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  box.add_css_class("audio-section")

  // Header row: label + mute button + percentage
  const header = new Gtk.Box({ spacing: 8 })

  const sectionLabel = new Gtk.Label({ halign: Gtk.Align.START })
  sectionLabel.set_label(label)
  sectionLabel.add_css_class("audio-section-label")
  sectionLabel.set_hexpand(true)

  const volPct = new Gtk.Label({ halign: Gtk.Align.END })
  volPct.add_css_class("audio-vol-pct")

  const muteBtn = new Gtk.Button()
  muteBtn.add_css_class("audio-mute-btn")

  header.append(sectionLabel)
  header.append(volPct)
  header.append(muteBtn)

  // Device name
  const deviceName = new Gtk.Label({ halign: Gtk.Align.START, ellipsize: 3 /* END */ })
  deviceName.add_css_class("audio-device-name")

  // Slider
  const slider = new Gtk.Scale({ orientation: Gtk.Orientation.HORIZONTAL, adjustment: adj })
  slider.set_hexpand(true)
  slider.set_draw_value(false)
  slider.add_css_class("audio-slider")

  box.append(header)
  box.append(deviceName)
  box.append(slider)

  function updateUI() {
    if (!_endpoint) return
    const vol = _endpoint.get_volume()
    const muted = _endpoint.get_mute()
    const desc = _endpoint.get_description() ?? _endpoint.get_name() ?? "Unknown"
    const icon = _endpoint.get_volume_icon()

    _updating = true
    adj.set_value(vol)
    _updating = false

    volPct.set_label(`${Math.round(vol * 100)}%`)
    muteBtn.set_label(muted ? "󰝟" : icon?.includes("low") ? "󰕿" : icon?.includes("medium") ? "󰖀" : "󰕾")
    muteBtn.set_tooltip_text(muted ? "Unmute" : "Mute")
    if (muted) muteBtn.add_css_class("audio-mute-btn-active")
    else muteBtn.remove_css_class("audio-mute-btn-active")
    deviceName.set_label(desc)
  }

  adj.connect("value-changed", () => {
    if (_updating || !_endpoint) return
    _endpoint.set_volume(adj.get_value())
  })

  muteBtn.connect("clicked", () => {
    if (!_endpoint) return
    _endpoint.set_mute(!_endpoint.get_mute())
  })

  return {
    widget: box,
    bind(ep) {
      // Disconnect old signals
      if (_endpoint && _volumeSignal) _endpoint.disconnect(_volumeSignal)
      if (_endpoint && _muteSignal) _endpoint.disconnect(_muteSignal)
      _endpoint = ep
      _volumeSignal = 0
      _muteSignal = 0

      if (!ep) {
        deviceName.set_label("No device")
        volPct.set_label("—")
        muteBtn.set_label("󰝟")
        return
      }

      _volumeSignal = ep.connect("notify::volume", updateUI)
      _muteSignal = ep.connect("notify::mute", updateUI)
      updateUI()
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Device list — imperative rows for switching active device
// ─────────────────────────────────────────────────────────────────────────────

function buildDeviceRows(
  endpoints: AstalWp.Endpoint[],
  container: Gtk.Box,
  onSelect: (ep: AstalWp.Endpoint) => void,
) {
  let child = container.get_first_child()
  while (child) {
    const next = child.get_next_sibling()
    container.remove(child)
    child = next
  }

  if (endpoints.length <= 1) {
    // Only one device — nothing to pick
    container.set_visible(false)
    return
  }
  container.set_visible(true)

  for (const ep of endpoints) {
    const btn = new Gtk.Button()
    btn.add_css_class("audio-device-row")
    if (ep.get_is_default()) btn.add_css_class("audio-device-row-active")

    const row = new Gtk.Box({ spacing: 6 })

    const icon = new Gtk.Label()
    icon.set_label(ep.get_is_default() ? "▶" : " ")
    icon.add_css_class("audio-device-row-icon")

    const name = new Gtk.Label({ halign: Gtk.Align.START, hexpand: true, ellipsize: 3 })
    name.set_label(ep.get_description() ?? ep.get_name() ?? "Unknown")
    name.add_css_class("audio-device-row-name")

    row.append(icon)
    row.append(name)
    btn.set_child(row)
    btn.connect("clicked", () => onSelect(ep))
    container.append(btn)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Popup window
// ─────────────────────────────────────────────────────────────────────────────

const POPUP_WIDTH = 300
const ARROW_WIDTH = 20

const _popups = new Map<Gdk.Monitor, Gtk.Window>()
const _revealers = new Map<Gdk.Monitor, Gtk.Revealer>()
const _arrows = new Map<Gdk.Monitor, Gtk.Box>()

function positionUnder(popup: Gtk.Window, monitor: Gdk.Monitor, arrowEl: Gtk.Box, sourceWidget: Gtk.Widget) {
  const root = sourceWidget.get_root() as any
  if (!root) return
  const [ok, bx] = sourceWidget.translate_coordinates(root, 0, 0)
  if (!ok) return

  const bw = sourceWidget.get_allocated_width()
  const btnCenterX = bx + bw / 2
  const monitorWidth = monitor.get_geometry().width

  const marginRight = Math.max(4, Math.min(
    monitorWidth - POPUP_WIDTH - 4,
    monitorWidth - btnCenterX - POPUP_WIDTH / 2,
  ))
  ;(popup as any).marginRight = marginRight

  if (arrowEl) {
    const popupLeftX = monitorWidth - marginRight - POPUP_WIDTH
    const btnWithinPopup = btnCenterX - popupLeftX
    arrowEl.set_margin_start(Math.max(4, Math.round(btnWithinPopup - ARROW_WIDTH / 2)))
  }
}

export function toggleAudioPopup(sourceWidget?: Gtk.Widget) {
  const monitor = (sourceWidget?.get_root() as any)?.gdkmonitor as Gdk.Monitor | undefined
  if (!monitor) return

  const popup = _popups.get(monitor)
  const revealer = _revealers.get(monitor)
  if (!popup || !revealer) return

  if (popup.visible && revealer.revealChild) {
    revealer.revealChild = false
    setTimeout(() => {
      if (!revealer.revealChild) {
        popup.visible = false
        updateBackdrop()
      }
    }, 200)
  } else {
    closeSidebar()
    closeAllPopups(popup)
    const arrow = _arrows.get(monitor)
    if (sourceWidget && arrow) positionUnder(popup, monitor, arrow, sourceWidget)
    popup.visible = true
    revealer.revealChild = true
    updateBackdrop()
  }
}

export function AudioPopup(gdkmonitor: Gdk.Monitor) {
  const wp = AstalWp.get_default()
  const audio = wp?.get_audio() ?? null

  // ── Slider sections ───────────────────────────────────────────────────────
  const outSection = makeSliderSection("OUTPUT")
  const inSection = makeSliderSection("INPUT")

  // ── Device lists ──────────────────────────────────────────────────────────
  const outDevices = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 3 })
  outDevices.add_css_class("audio-device-list")

  const inDevices = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 3 })
  inDevices.add_css_class("audio-device-list")

  function refreshSpeakers() {
    const spk = audio?.get_default_speaker() ?? null
    outSection.bind(spk)
    const all = audio?.get_speakers() ?? []
    buildDeviceRows(all, outDevices, ep => { ep.set_is_default(true) })
  }

  function refreshMics() {
    const mic = audio?.get_default_microphone() ?? null
    inSection.bind(mic)
    const all = audio?.get_microphones() ?? []
    buildDeviceRows(all, inDevices, ep => { ep.set_is_default(true) })
  }

  if (audio) {
    audio.connect("speaker-added", refreshSpeakers)
    audio.connect("speaker-removed", refreshSpeakers)
    audio.connect("microphone-added", refreshMics)
    audio.connect("microphone-removed", refreshMics)
    audio.connect("notify::default-speaker", refreshSpeakers)
    audio.connect("notify::default-microphone", refreshMics)
  }

  refreshSpeakers()
  refreshMics()

  // ── Arrow: imperative element so we can set margin_start dynamically ────
  const arrowEl = new Gtk.Box()
  arrowEl.add_css_class("audio-popup-arrow")

  const revealer = new Gtk.Revealer({
    transitionType: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transitionDuration: 200,
    child: (
      <box orientation={1} class="audio-popup-outer">
        <box class="audio-popup-arrow-row">
          {arrowEl}
        </box>
        <box orientation={1} spacing={10} class="audio-popup-content">
          <label label="AUDIO" class="audio-popup-title" halign={Gtk.Align.START} />
          {outSection.widget}
          {outDevices}
          <box class="audio-popup-divider" />
          {inSection.widget}
          {inDevices}
        </box>
      </box>
    ) as Gtk.Widget
  })

  // ── Window ────────────────────────────────────────────────────────────────
  const { TOP, RIGHT } = Astal.WindowAnchor

  const win = (
    <window
      name="audio-popup"
      visible={false}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      anchor={TOP | RIGHT}
      application={app}
      class="AudioPopup"
      marginTop={4}
      marginRight={8}
      widthRequest={POPUP_WIDTH}
    >
      {revealer}
    </window>
  ) as Gtk.Window

  _popups.set(gdkmonitor, win)
  _revealers.set(gdkmonitor, revealer)
  _arrows.set(gdkmonitor, arrowEl)
  return win
}
