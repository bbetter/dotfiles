import { createPoll } from "ags/time"
import { Gtk, Gdk } from "ags/gtk4"
import AstalBluetooth from "gi://AstalBluetooth"
import { toggleBluetoothPopup } from "../BluetoothPopup"
import app from "ags/gtk4/app"

export function BluetoothIndicator({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const bt = AstalBluetooth.get_default()
  const monitorName = gdkmonitor.get_connector() ?? "default"

  const label = createPoll("", 500, () => {
    if (!bt.get_is_powered()) return ""
    const connected = bt.get_devices().filter(d => d.get_connected())
    if (connected.length === 0) return "󰂯"
    const d = connected[0]
    const bat = d.get_battery_percentage()
    const batStr = bat >= 0 ? ` ${Math.round(bat)}%` : ""
    return `󰂱 ${d.get_alias() ?? d.get_name() ?? ""}${batStr}`
  })

  const visible = createPoll(false, 500, () => bt.get_is_powered())

  const btn = (
    <button
      class="bluetooth"
      visible={visible}
      onClicked={() => toggleBluetoothPopup(btn)}
    >
      <label label={label} />
    </button>
  ) as Gtk.Button

  setTimeout(() => {
    const winName = `bluetooth-popup-${monitorName}`
    const win = app.get_windows().find(w => w.name === winName)
    if (win) {
      win.connect("notify::visible", (w) => {
        if (w.visible) btn.add_css_class("active")
        else btn.remove_css_class("active")
      })
      if (win.visible) btn.add_css_class("active")
    }
  }, 500)

  return btn
}
