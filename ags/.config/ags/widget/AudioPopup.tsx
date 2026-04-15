import { Gtk, Gdk, Astal } from "ags/gtk4"
import AstalWp from "gi://AstalWp"
import { createPopup, PopupHandle } from "./BasePopup"

// ─────────────────────────────────────────────────────────────────────────────
// Volume slider section — imperative (Gtk.Scale + Gtk.Adjustment)
// ─────────────────────────────────────────────────────────────────────────────

interface SliderSection {
    widget: Gtk.Box
    bind(endpoint: AstalWp.Endpoint | null): void
}

function makeSliderSection(label: string): SliderSection {
    let _endpoint: AstalWp.Endpoint | null = null
    let _volumeSignal = 0
    let _muteSignal = 0
    let _updating = false

    const adj = new Gtk.Adjustment({ lower: 0, upper: 1.5, step_increment: 0.05, page_increment: 0.1 })
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
    box.add_css_class("audio-section")

    const header = new Gtk.Box({ spacing: 8 })
    const sectionLabel = new Gtk.Label({ halign: Gtk.Align.START, hexpand: true })
    sectionLabel.set_label(label)
    sectionLabel.add_css_class("audio-section-label")

    const volPct = new Gtk.Label({ halign: Gtk.Align.END })
    volPct.add_css_class("audio-vol-pct")

    const muteBtn = new Gtk.Button()
    muteBtn.add_css_class("audio-mute-btn")

    header.append(sectionLabel)
    header.append(volPct)
    header.append(muteBtn)

    const deviceName = new Gtk.Label({ halign: Gtk.Align.START, ellipsize: 3 })
    deviceName.add_css_class("audio-device-name")

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
            if (_endpoint && _volumeSignal) _endpoint.disconnect(_volumeSignal)
            if (_endpoint && _muteSignal) _endpoint.disconnect(_muteSignal)
            _endpoint = ep
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

const _handles = new Map<Gdk.Monitor, PopupHandle>()

export function toggleAudioPopup(sourceWidget?: Gtk.Widget) {
    const monitor = (sourceWidget?.get_root() as any)?.gdkmonitor as Gdk.Monitor | undefined
    if (!monitor) return
    const handle = _handles.get(monitor)
    if (handle) handle.toggle(sourceWidget)
}

export function AudioPopup(gdkmonitor: Gdk.Monitor) {
    const wp = AstalWp.get_default()
    const audio = wp?.get_audio() ?? null

    const outSection = makeSliderSection("OUTPUT")
    const inSection = makeSliderSection("INPUT")
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

    const content = (
        <box orientation={1} spacing={10}>
            <label label="AUDIO" class="audio-popup-title" halign={Gtk.Align.START} />
            {outSection.widget}
            {outDevices}
            <box class="audio-popup-divider" />
            {inSection.widget}
            {inDevices}
        </box>
    ) as Gtk.Widget

    const handle = createPopup({
        name: "audio-popup",
        className: "AudioPopup",
        baseClassName: "audio-popup",
        gdkmonitor,
        anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
        defaultWidth: 340,
        child: content
    })

    _handles.set(gdkmonitor, handle)
    return handle.window
}
