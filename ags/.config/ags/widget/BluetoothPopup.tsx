import { Gtk, Gdk, Astal } from "ags/gtk4"
import AstalBluetooth from "gi://AstalBluetooth"
import { createPopup, PopupHandle } from "./BasePopup"

function deviceIcon(icon: string): string {
    if (icon.includes("phone")) return "󰏲"
    if (icon.includes("headphone") || icon.includes("headset") || icon.includes("audio")) return "󰋋"
    if (icon.includes("keyboard")) return "󰌌"
    if (icon.includes("mouse")) return "󰍽"
    if (icon.includes("gaming") || icon.includes("joystick")) return "󰊗"
    if (icon.includes("computer")) return "󰌢"
    if (icon.includes("watch")) return "󱑈"
    return "󰂯"
}

function buildDeviceRows(devices: AstalBluetooth.Device[], container: Gtk.Box, filter: string = "") {
    let child = container.get_first_child()
    while (child) {
        const next = child.get_next_sibling()
        container.remove(child)
        child = next
    }
    const paired = devices.filter(d => {
        if (!d.get_paired()) return false
        if (filter) {
            const name = (d.get_alias() ?? d.get_name() ?? d.get_address() ?? "").toLowerCase()
            if (!name.includes(filter.toLowerCase())) return false
        }
        return true
    })
    if (paired.length === 0) {
        const empty = new Gtk.Label({ halign: Gtk.Align.START })
        empty.set_label("No paired devices")
        empty.add_css_class("bt-empty-label")
        container.append(empty)
        return
    }
    for (const device of paired) {
        const row = new Gtk.Box({ spacing: 8 })
        row.add_css_class("bt-device-row")
        const icon = new Gtk.Label()
        icon.set_label(deviceIcon(device.get_icon() ?? ""))
        icon.add_css_class("bt-device-icon")
        const info = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1 })
        info.set_hexpand(true)
        const name = new Gtk.Label({ halign: Gtk.Align.START, ellipsize: 3 })
        name.set_label(device.get_alias() ?? device.get_name() ?? device.get_address())
        name.add_css_class("bt-device-name")
        if (device.get_connected()) name.add_css_class("bt-device-name-connected")
        info.append(name)
        const bat = device.get_battery_percentage()
        if (bat >= 0) {
            const batLabel = new Gtk.Label({ halign: Gtk.Align.START })
            batLabel.set_label(`󰁹 ${Math.round(bat)}%`)
            batLabel.add_css_class("bt-device-battery")
            info.append(batLabel)
        }
        const btn = new Gtk.Button()
        if (device.get_connected()) {
            btn.set_label("Disconnect")
            btn.add_css_class("bt-action-btn")
            btn.add_css_class("bt-action-btn-disconnect")
            btn.connect("clicked", () => { device.disconnect_device().catch(() => { }) })
        } else if (device.get_connecting()) {
            btn.set_label("…")
            btn.add_css_class("bt-action-btn")
            btn.set_sensitive(false)
        } else {
            btn.set_label("Connect")
            btn.add_css_class("bt-action-btn")
            btn.connect("clicked", () => { device.connect_device().catch(() => { }) })
        }
        row.append(icon)
        row.append(info)
        row.append(btn)
        container.append(row)
    }
}

const _handles = new Map<Gdk.Monitor, PopupHandle>()

export function toggleBluetoothPopup(sourceWidget?: Gtk.Widget) {
    const monitor = (sourceWidget?.get_root() as any)?.gdkmonitor as Gdk.Monitor | undefined
    if (!monitor) return
    const handle = _handles.get(monitor)
    if (handle) handle.toggle(sourceWidget)
}

export function BluetoothPopup(gdkmonitor: Gdk.Monitor) {
    const bt = AstalBluetooth.get_default()
    const adapter = bt?.get_adapter() ?? null

    const powerBtn = new Gtk.Button()
    powerBtn.add_css_class("bt-power-btn")
    function updatePowerBtn() {
        const on = bt?.get_is_powered() ?? false
        powerBtn.set_label(on ? "󰂯  On" : "󰂲  Off")
        if (on) { powerBtn.remove_css_class("bt-power-btn-off"); powerBtn.add_css_class("bt-power-btn-on") }
        else { powerBtn.remove_css_class("bt-power-btn-on"); powerBtn.add_css_class("bt-power-btn-off") }
    }
    powerBtn.connect("clicked", () => { bt?.toggle() })
    bt?.connect("notify::is-powered", updatePowerBtn)
    updatePowerBtn()

    const scanBtn = new Gtk.Button()
    scanBtn.add_css_class("bt-scan-btn")
    function updateScanBtn() {
        const discovering = adapter?.get_discovering() ?? false
        scanBtn.set_label(discovering ? "Stop Scan" : "Scan")
        if (discovering) scanBtn.add_css_class("bt-scan-btn-active")
        else scanBtn.remove_css_class("bt-scan-btn-active")
    }
    scanBtn.connect("clicked", () => {
        if (adapter?.get_discovering()) adapter.stop_discovery()
        else adapter?.start_discovery()
    })
    adapter?.connect("notify::discovering", updateScanBtn)
    updateScanBtn()

    const deviceList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
    deviceList.add_css_class("bt-device-list")
    
    function refresh(filter: string = "") { buildDeviceRows(bt?.get_devices() ?? [], deviceList, filter) }

    const searchEntry = new Gtk.Entry({ 
        placeholderText: "Search devices...",
        hexpand: true
    })
    searchEntry.add_css_class("popup-search-entry")
    searchEntry.connect("changed", () => refresh(searchEntry.get_text()))

    bt?.connect("device-added", () => refresh(searchEntry.get_text()))
    bt?.connect("device-removed", () => refresh(searchEntry.get_text()))
    bt?.connect("notify::devices", () => refresh(searchEntry.get_text()))
    
    for (const device of bt?.get_devices() ?? []) {
        device.connect("notify::connected", () => refresh(searchEntry.get_text()))
        device.connect("notify::connecting", () => refresh(searchEntry.get_text()))
        device.connect("notify::battery-percentage", () => refresh(searchEntry.get_text()))
    }
    refresh()

    const content = (
        <box orientation={1} spacing={10}>
            <box spacing={8}>
                <label label="BLUETOOTH" class="bt-popup-title" hexpand halign={Gtk.Align.START} />
                {scanBtn}
                {powerBtn}
            </box>
            {searchEntry}
            {deviceList}
        </box>
    ) as Gtk.Widget

    const handle = createPopup({
        name: "bluetooth-popup",
        className: "BluetoothPopup",
        baseClassName: "bt-popup",
        gdkmonitor,
        anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
        defaultWidth: 340,
        child: content
    })

    _handles.set(gdkmonitor, handle)
    return handle.window
}
