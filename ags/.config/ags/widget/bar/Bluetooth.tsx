import { createBinding, createComputed } from "gnim"
import { Gtk, Gdk } from "ags/gtk4"
import AstalBluetooth from "gi://AstalBluetooth"
import { toggleBluetoothPopup } from "../BluetoothPopup"
import { bindActiveClass } from "../utils/popupActiveClass"

export function BluetoothIndicator({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const bt = AstalBluetooth.get_default()
  const monitorName = gdkmonitor.get_connector() ?? "default"

  // Updates on adapter power and on the device list changing (connect/disconnect).
  // Battery % refreshes on those events rather than ticking live — good enough
  // for a bar pill and avoids a 2 Hz poll.
  const powered = createBinding(bt, "isPowered")
  const devices = createBinding(bt, "devices")

  const label = createComputed(() => {
    if (!powered()) return "󰂲"
    const connected = devices().filter(d => d.connected)
    if (connected.length === 0) return "󰂯"
    const d = connected[0]
    const bat = d.batteryPercentage
    const batStr = bat >= 0 ? ` ${Math.round(bat)}%` : ""
    return `󰂱 ${d.alias ?? d.name ?? ""}${batStr}`
  })

  // Stay visible when the adapter is off (dimmed) so the popup — and the
  // power toggle inside it — is still reachable.
  const cssClass = createComputed(() => powered() ? "bluetooth" : "bluetooth bt-off")

  const btn = (
    <button
      class={cssClass}
      onClicked={() => toggleBluetoothPopup(btn)}
    >
      <label label={label} />
    </button>
  ) as Gtk.Button

  bindActiveClass(btn, "bluetooth-popup", monitorName)

  return btn
}
