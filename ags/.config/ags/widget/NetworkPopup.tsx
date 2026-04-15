import { Gtk, Gdk, Astal } from "ags/gtk4"
import AstalNetwork from "gi://AstalNetwork"
import { createPopup, PopupHandle } from "./BasePopup"

function strengthBar(s: number): string {
    if (s >= 80) return "▂▄▆█"
    if (s >= 60) return "▂▄▆_"
    if (s >= 40) return "▂▄__"
    if (s >= 20) return "▂___"
    return "____"
}

function internetText(v: AstalNetwork.Internet): string {
    if (v === AstalNetwork.Internet.CONNECTED) return "Connected"
    if (v === AstalNetwork.Internet.CONNECTING) return "Connecting…"
    return "Disconnected"
}

function buildApRows(wifi: AstalNetwork.Wifi, container: Gtk.Box, onApClick: (ap: AstalNetwork.AccessPoint) => void, filter: string = "") {
    let child = container.get_first_child()
    while (child) {
        const next = child.get_next_sibling()
        container.remove(child)
        child = next
    }
    const active = wifi.get_active_access_point()
    const seen = new Set<string>()
    const sorted = [...wifi.get_access_points()]
        .filter(ap => {
            const ssid = ap.get_ssid()
            if (!ssid || seen.has(ssid)) return false
            if (filter && !ssid.toLowerCase().includes(filter.toLowerCase())) return false
            seen.add(ssid)
            return true
        })
        .sort((a, b) => b.get_strength() - a.get_strength())
    for (const ap of sorted) {
        const ssid = ap.get_ssid()!
        const isActive = ap === active
        const btn = new Gtk.Button()
        btn.add_css_class("network-ap-row")
        if (isActive) btn.add_css_class("network-ap-active")
        const row = new Gtk.Box({ spacing: 6 })
        const nameLabel = new Gtk.Label({ halign: Gtk.Align.START, hexpand: true })
        nameLabel.set_label(ssid)
        nameLabel.add_css_class("network-ap-name")
        if (isActive) nameLabel.add_css_class("network-ap-name-active")
        const lockLabel = new Gtk.Label()
        lockLabel.set_label(ap.get_requires_password() ? "󰌾" : " ")
        lockLabel.add_css_class("network-ap-lock")
        const sigLabel = new Gtk.Label()
        sigLabel.set_label(strengthBar(ap.get_strength()))
        sigLabel.add_css_class("network-ap-strength")
        row.append(nameLabel); row.append(lockLabel); row.append(sigLabel)
        btn.set_child(row)
        btn.connect("clicked", () => onApClick(ap))
        container.append(btn)
    }
}

interface PwSection { widget: Gtk.Box; show(ap: AstalNetwork.AccessPoint): void; hide(): void }

function makePwSection(): PwSection {
    let pendingAp: AstalNetwork.AccessPoint | null = null
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    box.add_css_class("network-password-box"); box.set_visible(false)
    const prompt = new Gtk.Label({ halign: Gtk.Align.START })
    prompt.add_css_class("network-password-prompt")
    const entry = new Gtk.Entry()
    entry.set_placeholder_text("Wi-Fi Password"); entry.set_visibility(false); entry.set_hexpand(true)
    const btnRow = new Gtk.Box({ spacing: 8, homogeneous: true })
    const cancelBtn = new Gtk.Button(); cancelBtn.set_label("Cancel"); cancelBtn.add_css_class("network-btn")
    const connectBtn = new Gtk.Button(); connectBtn.set_label("Connect"); connectBtn.add_css_class("network-btn"); connectBtn.add_css_class("network-btn-primary")
    btnRow.append(cancelBtn); btnRow.append(connectBtn)
    box.append(prompt); box.append(entry); box.append(btnRow)
    const doConnect = () => {
        if (!pendingAp) return
        pendingAp.activate(entry.get_text() || null).catch(() => { })
        entry.set_text(""); box.set_visible(false); pendingAp = null
    }
    connectBtn.connect("clicked", doConnect); entry.connect("activate", doConnect)
    cancelBtn.connect("clicked", () => { entry.set_text(""); box.set_visible(false); pendingAp = null })
    return {
        widget: box,
        show(ap) { pendingAp = ap; prompt.set_label(`Password for "${ap.get_ssid()}"`); entry.set_text(""); box.set_visible(true); entry.grab_focus() },
        hide() { box.set_visible(false); entry.set_text(""); pendingAp = null }
    }
}

const _handles = new Map<Gdk.Monitor, PopupHandle>()

export function toggleNetworkPopup(sourceWidget?: Gtk.Widget) {
    const root = sourceWidget?.get_root() as any
    const monitor = root?.gdkmonitor || root?.monitor
    if (!monitor) {
        console.error("AGS: Could not determine monitor for NetworkPopup")
        return
    }
    const handle = _handles.get(monitor)
    if (handle) handle.toggle(sourceWidget)
    else console.error(`AGS: No NetworkPopup handle for monitor ${monitor.get_connector()}`)
}

export function NetworkPopup(gdkmonitor: Gdk.Monitor) {
    const monitorName = gdkmonitor.get_connector() ?? "default"
    // ... rest of setup code ...
    const network = AstalNetwork.get_default()
    const wifi = network?.get_wifi() ?? null
    const wired = network?.get_wired() ?? null

    const ssidLabel = new Gtk.Label({ halign: Gtk.Align.END, hexpand: true })
    ssidLabel.add_css_class("network-popup-value")
    ssidLabel.set_label(wifi?.get_ssid() ?? "Not connected")

    const wiredLabel = new Gtk.Label({ halign: Gtk.Align.END, hexpand: true })
    wiredLabel.add_css_class("network-popup-value")
    wiredLabel.set_label(wired ? internetText(wired.get_internet()) : "No device")

    const apContainer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
    apContainer.add_css_class("network-ap-list")
    const pw = makePwSection()

    function handleApClick(ap: AstalNetwork.AccessPoint) {
        pw.hide()
        if (ap.get_requires_password() && ap.get_connections().length === 0) pw.show(ap)
        else ap.activate(null).catch(() => { })
    }
    
    function refreshAps(filter: string = "") { if (wifi) buildApRows(wifi, apContainer, handleApClick, filter) }

    const searchEntry = new Gtk.Entry({ 
        placeholderText: "Search networks...",
        hexpand: true
    })
    searchEntry.add_css_class("popup-search-entry")
    searchEntry.connect("changed", () => refreshAps(searchEntry.get_text()))

    if (wifi) {
        wifi.connect("notify::ssid", () => ssidLabel.set_label(wifi.get_ssid() ?? "Not connected"))
        wifi.connect("access-point-added", () => refreshAps(searchEntry.get_text()))
        wifi.connect("access-point-removed", () => refreshAps(searchEntry.get_text()))
        wifi.connect("notify::active-access-point", () => { 
            ssidLabel.set_label(wifi.get_ssid() ?? "Not connected")
            refreshAps(searchEntry.get_text()) 
        })
    }
    if (wired) wired.connect("notify::internet", () => wiredLabel.set_label(internetText(wired.get_internet())))
    refreshAps()

    const scanBtn = new Gtk.Button(); scanBtn.add_css_class("network-scan-btn"); scanBtn.set_label("↺"); scanBtn.connect("clicked", () => wifi?.scan())

    const content = (
        <box orientation={1} spacing={10}>
            <label label="NETWORK" class="network-popup-title" halign={Gtk.Align.START} />
            {searchEntry}
            <box spacing={8} class="network-popup-card network-popup-row">
                <label label="LAN" class="network-popup-label" />
                {wiredLabel}
            </box>
            <box spacing={8} class="network-popup-card network-popup-row">
                <label label="Wi-Fi" class="network-popup-label" />
                {ssidLabel}
                {scanBtn}
            </box>
            {apContainer}
            {pw.widget}
        </box>
    ) as Gtk.Widget

    const handle = createPopup({
        name: `network-popup-${monitorName}`,
        className: "NetworkPopup",
        baseClassName: "network-popup",
        gdkmonitor,
        anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
        defaultWidth: 340,
        child: content
    })

    const win = handle.window
    win.connect("notify::visible", () => {
        if (win.visible) {
            searchEntry.grab_focus()
        }
    })

    _handles.set(gdkmonitor, handle)
    return win
}
