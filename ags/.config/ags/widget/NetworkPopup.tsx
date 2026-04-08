import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import AstalNetwork from "gi://AstalNetwork"
import { closeAllPopups, updateBackdrop } from "./PopupManager"
import { closeSidebar } from "./sidebar/state"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// AP list — built imperatively (no JSX in callbacks, avoids gnim scope errors)
// ─────────────────────────────────────────────────────────────────────────────

function buildApRows(
  wifi: AstalNetwork.Wifi,
  container: Gtk.Box,
  onApClick: (ap: AstalNetwork.AccessPoint) => void,
) {
  // Clear existing children
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

    row.append(nameLabel)
    row.append(lockLabel)
    row.append(sigLabel)
    btn.set_child(row)
    btn.connect("clicked", () => onApClick(ap))

    container.append(btn)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Password section — fully imperative
// ─────────────────────────────────────────────────────────────────────────────

interface PwSection {
  widget: Gtk.Box
  show(ap: AstalNetwork.AccessPoint): void
  hide(): void
}

function makePwSection(): PwSection {
  let pendingAp: AstalNetwork.AccessPoint | null = null

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  box.add_css_class("network-password-box")
  box.set_visible(false)

  const prompt = new Gtk.Label({ halign: Gtk.Align.START })
  prompt.add_css_class("network-password-prompt")

  const entry = new Gtk.Entry()
  entry.set_placeholder_text("Wi-Fi Password")
  entry.set_visibility(false)
  entry.set_hexpand(true)

  const btnRow = new Gtk.Box({ spacing: 8, homogeneous: true })

  const cancelBtn = new Gtk.Button()
  cancelBtn.set_label("Cancel")
  cancelBtn.add_css_class("network-btn")

  const connectBtn = new Gtk.Button()
  connectBtn.set_label("Connect")
  connectBtn.add_css_class("network-btn")
  connectBtn.add_css_class("network-btn-primary")

  btnRow.append(cancelBtn)
  btnRow.append(connectBtn)
  box.append(prompt)
  box.append(entry)
  box.append(btnRow)

  const doConnect = () => {
    if (!pendingAp) return
    const pwd = entry.get_text() || null
    pendingAp.activate(pwd).catch(() => { /* ignore */ })
    entry.set_text("")
    box.set_visible(false)
    pendingAp = null
  }

  connectBtn.connect("clicked", doConnect)
  entry.connect("activate", doConnect) // Enter key

  cancelBtn.connect("clicked", () => {
    entry.set_text("")
    box.set_visible(false)
    pendingAp = null
  })

  return {
    widget: box,
    show(ap) {
      pendingAp = ap
      prompt.set_label(`Password for "${ap.get_ssid()}"`)
      entry.set_text("")
      box.set_visible(true)
      entry.grab_focus()
    },
    hide() {
      box.set_visible(false)
      entry.set_text("")
      pendingAp = null
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Popup window
// ─────────────────────────────────────────────────────────────────────────────

const POPUP_WIDTH = 320
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

export function toggleNetworkPopup(sourceWidget?: Gtk.Widget) {
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

export function NetworkPopup(gdkmonitor: Gdk.Monitor) {
  const network = AstalNetwork.get_default()
  const wifi = network?.get_wifi() ?? null
  const wired = network?.get_wired() ?? null

  // Labels updated via GObject signals
  const ssidLabel = new Gtk.Label({ halign: Gtk.Align.END, hexpand: true })
  ssidLabel.add_css_class("network-popup-value")
  ssidLabel.set_label(wifi?.get_ssid() ?? "Not connected")

  const wiredLabel = new Gtk.Label({ halign: Gtk.Align.END, hexpand: true })
  wiredLabel.add_css_class("network-popup-value")
  wiredLabel.set_label(wired ? internetText(wired.get_internet()) : "No device")

  // AP list container
  const apContainer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  apContainer.add_css_class("network-ap-list")

  // Password section
  const pw = makePwSection()

  // ── AP click handler ──────────────────────────────────────────────────────
  function handleApClick(ap: AstalNetwork.AccessPoint) {
    pw.hide()
    const hasSaved = ap.get_connections().length > 0
    if (ap.get_requires_password() && !hasSaved) {
      pw.show(ap)
    } else {
      ap.activate(null).catch(() => { /* ignore */ })
    }
  }

  function refreshAps() {
    if (wifi) buildApRows(wifi, apContainer, handleApClick)
  }

  // ── GObject signal wiring ─────────────────────────────────────────────────
  if (wifi) {
    wifi.connect("notify::ssid", () => {
      ssidLabel.set_label(wifi.get_ssid() ?? "Not connected")
    })
    wifi.connect("access-point-added", refreshAps)
    wifi.connect("access-point-removed", refreshAps)
    wifi.connect("notify::active-access-point", () => {
      ssidLabel.set_label(wifi.get_ssid() ?? "Not connected")
      refreshAps()
    })
  }
  if (wired) {
    wired.connect("notify::internet", () => {
      wiredLabel.set_label(internetText(wired.get_internet()))
    })
  }

  // Initial population
  refreshAps()

  // ── Scan button ───────────────────────────────────────────────────────────
  const scanBtn = new Gtk.Button()
  scanBtn.add_css_class("network-scan-btn")
  scanBtn.set_label("↺")
  scanBtn.connect("clicked", () => { wifi?.scan() })

  // ── Arrow: imperative element so we can set margin_start dynamically ────
  const arrowEl = new Gtk.Box()
  arrowEl.add_css_class("network-popup-arrow")

  const revealer = new Gtk.Revealer({
    transitionType: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transitionDuration: 200,
    child: (
      <box orientation={1} class="network-popup-outer">
        {/* Arrow tip — margin_start on arrowEl controls where it points */}
        <box class="network-popup-arrow-row">
          {arrowEl}
        </box>
        {/* Main card */}
        <box orientation={1} spacing={10} class="network-popup-content">
          <label label="NETWORK" class="network-popup-title" halign={Gtk.Align.START} />

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
      </box>
    ) as Gtk.Widget
  })

  // ── JSX shell ─────────────────────────────────────────────────────────────
  const { TOP, RIGHT } = Astal.WindowAnchor

  const win = (
    <window
      name="network-popup"
      visible={false}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      anchor={TOP | RIGHT}
      application={app}
      class="NetworkPopup"
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
