import { createBinding } from "gnim"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import AstalNetwork from "gi://AstalNetwork"
import AstalBluetooth from "gi://AstalBluetooth"
import { onSidebarOpen } from "./state"

// idle.sh's swayidle skips the lock / screen-blank timeouts while this file
// exists. Runtime dir → clears on logout.
const GUARD = `${GLib.get_user_runtime_dir()}/ags-keep-awake`

function makeToggle(iconOn: string, iconOff: string, tooltip: string) {
  const icon = new Gtk.Label({ label: iconOff })
  const btn = (
    <button class="sidebar-toggle-pill" tooltipText={tooltip}>
      {icon}
    </button>
  ) as Gtk.Button

  let active = false
  const apply = () => {
    icon.label = active ? iconOn : iconOff
    if (active) btn.add_css_class("active")
    else btn.remove_css_class("active")
  }

  return {
    btn,
    set(v: boolean) {
      active = v
      apply()
    },
    get() {
      return active
    },
    click(cb: () => void) {
      btn.connect("clicked", cb)
    },
  }
}

export function SidebarToggles() {
  const row = (<box spacing={8} homogeneous class="sidebar-toggle-row" />) as Gtk.Box

  // Keep awake -------------------------------------------------------------
  const ka = makeToggle("󰅶", "󰾪", "Keep awake — pause idle lock & screen-blank")
  ka.set(GLib.file_test(GUARD, GLib.FileTest.EXISTS))
  ka.click(() => {
    const next = !ka.get()
    try {
      if (next) GLib.file_set_contents(GUARD, "")
      else Gio.File.new_for_path(GUARD).delete(null)
    } catch {
      /* best effort */
    }
    ka.set(next)
  })
  row.append(ka.btn)

  // Do Not Disturb (swaync) ---------------------------------------------- -
  const dnd = makeToggle("󰂛", "󰂚", "Do Not Disturb")
  const refreshDnd = () =>
    execAsync(["swaync-client", "-D", "-sw"])
      .then(o => dnd.set(o.trim().toLowerCase() === "true"))
      .catch(() => {})
  refreshDnd()
  onSidebarOpen(refreshDnd)
  dnd.click(() =>
    execAsync(["swaync-client", "-d", "-sw"])
      .then(o => dnd.set(o.trim().toLowerCase() === "true"))
      .catch(() => {}),
  )
  row.append(dnd.btn)

  // Wi-Fi ---------------------------------------------------------------- -
  const net = AstalNetwork.get_default()
  if (net?.wifi) {
    const wifi = makeToggle("󰤨", "󰤭", "Wi-Fi")
    const b = createBinding(net, "wifi", "enabled")
    const sync = () => wifi.set(!!b())
    sync()
    b.subscribe(sync)
    wifi.click(() => {
      try {
        net.wifi.enabled = !net.wifi.enabled
      } catch {
        /* radio went away */
      }
    })
    row.append(wifi.btn)
  }

  // Bluetooth ---------------------------------------------------------- ---
  const bt = AstalBluetooth.get_default()
  if (bt) {
    const blue = makeToggle("󰂯", "󰂲", "Bluetooth")
    const b = createBinding(bt, "isPowered")
    const sync = () => blue.set(!!b())
    sync()
    b.subscribe(sync)
    blue.click(() => {
      try {
        const adapter = bt.adapter
        if (adapter) adapter.powered = !adapter.powered
      } catch {
        /* no adapter */
      }
    })
    row.append(blue.btn)
  }

  return row
}
