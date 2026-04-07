import { createPoll } from "ags/time"
import { Gtk } from "ags/gtk4"
import AstalBluetooth from "gi://AstalBluetooth"
import { toggleBluetoothPopup } from "../BluetoothPopup"

export function BluetoothIndicator() {
  const bt = AstalBluetooth.get_default()

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

  return btn
}
