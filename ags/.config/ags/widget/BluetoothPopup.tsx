import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import AstalBluetooth from "gi://AstalBluetooth"
import { closeAllPopups, updateBackdrop } from "./PopupManager"
import { closeSidebar } from "./sidebar/state"

// ─────────────────────────────────────────────────────────────────────────────
// Device list — imperative rows
// ─────────────────────────────────────────────────────────────────────────────

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

function buildDeviceRows(
  devices: AstalBluetooth.Device[],
  container: Gtk.Box,
) {
  let child = container.get_first_child()
  while (child) {
    const next = child.get_next_sibling()
    container.remove(child)
    child = next
  }

  const paired = devices.filter(d => d.get_paired())
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
      btn.connect("clicked", () => {
        device.disconnect_device().catch(() => { /* ignore */ })
      })
    } else if (device.get_connecting()) {
      btn.set_label("…")
      btn.add_css_class("bt-action-btn")
      btn.set_sensitive(false)
    } else {
      btn.set_label("Connect")
      btn.add_css_class("bt-action-btn")
      btn.connect("clicked", () => {
        device.connect_device().catch(() => { /* ignore */ })
      })
    }

    row.append(icon)
    row.append(info)
    row.append(btn)
    container.append(row)
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

export function toggleBluetoothPopup(sourceWidget?: Gtk.Widget) {
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

export function BluetoothPopup(gdkmonitor: Gdk.Monitor) {
  const bt = AstalBluetooth.get_default()
  const adapter = bt?.get_adapter() ?? null

  // ── Power toggle ──────────────────────────────────────────────────────────
  const powerBtn = new Gtk.Button()
  powerBtn.add_css_class("bt-power-btn")

  function updatePowerBtn() {
    const on = bt?.get_is_powered() ?? false
    powerBtn.set_label(on ? "󰂯  On" : "󰂲  Off")
    if (on) {
      powerBtn.remove_css_class("bt-power-btn-off")
      powerBtn.add_css_class("bt-power-btn-on")
    } else {
      powerBtn.remove_css_class("bt-power-btn-on")
      powerBtn.add_css_class("bt-power-btn-off")
    }
  }

  powerBtn.connect("clicked", () => { bt?.toggle() })
  bt?.connect("notify::is-powered", updatePowerBtn)
  updatePowerBtn()

  // ── Scan button ───────────────────────────────────────────────────────────
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

  // ── Device list ───────────────────────────────────────────────────────────
  const deviceList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  deviceList.add_css_class("bt-device-list")

  function refresh() {
    buildDeviceRows(bt?.get_devices() ?? [], deviceList)
  }

  bt?.connect("device-added", refresh)
  bt?.connect("device-removed", refresh)
  bt?.connect("notify::devices", refresh)

  // Re-render when any device's connection state changes
  bt?.connect("device-added", (_bt, device: AstalBluetooth.Device) => {
    device.connect("notify::connected", refresh)
    device.connect("notify::connecting", refresh)
    device.connect("notify::battery-percentage", refresh)
  })
  // Wire existing devices
  for (const device of bt?.get_devices() ?? []) {
    device.connect("notify::connected", refresh)
    device.connect("notify::connecting", refresh)
    device.connect("notify::battery-percentage", refresh)
  }

  refresh()

  // ── Arrow: imperative element so we can set margin_start dynamically ────
  const arrowEl = new Gtk.Box()
  arrowEl.add_css_class("bt-popup-arrow")

  const revealer = new Gtk.Revealer({
    transitionType: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transitionDuration: 200,
    child: (
      <box orientation={1} class="bt-popup-outer">
        <box class="bt-popup-arrow-row">
          {arrowEl}
        </box>
        <box orientation={1} spacing={10} class="bt-popup-content">
          <box spacing={8}>
            <label label="BLUETOOTH" class="bt-popup-title" hexpand halign={Gtk.Align.START} />
            {scanBtn}
            {powerBtn}
          </box>
          {deviceList}
        </box>
      </box>
    ) as Gtk.Widget
  })

  // ── Window ────────────────────────────────────────────────────────────────
  const { TOP, RIGHT } = Astal.WindowAnchor

  const win = (
    <window
      name="bluetooth-popup"
      visible={false}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      anchor={TOP | RIGHT}
      application={app}
      class="BluetoothPopup"
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
