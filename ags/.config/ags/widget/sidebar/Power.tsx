import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import { closeSidebar } from "./state"

interface PowerAction {
  icon: string
  label: string
  cmd: string[]
  confirm?: boolean   // two-click: first arms, second (within 3s) fires
  preClose?: boolean  // close the drawer before running
}

const ACTIONS: PowerAction[] = [
  { icon: "󰌾", label: "Lock",      cmd: ["swaylock", "-f"],           preClose: true },
  { icon: "󰤄", label: "Suspend",   cmd: ["systemctl", "suspend"],     preClose: true },
  { icon: "󰩈", label: "Log out",   cmd: ["hyprctl", "dispatch", "exit"] },
  { icon: "󰜉", label: "Reboot",    cmd: ["systemctl", "reboot"],      confirm: true },
  { icon: "󰐥", label: "Shut down", cmd: ["systemctl", "poweroff"],    confirm: true },
]

const ARMED_ICON = "󰀦"

export function SidebarPower() {
  const row = (<box spacing={4} class="sidebar-power-row" />) as Gtk.Box

  for (const action of ACTIONS) {
    const icon = new Gtk.Label({ label: action.icon })
    const btn = (
      <button class="sidebar-power-btn" tooltipText={action.label}>
        {icon}
      </button>
    ) as Gtk.Button

    let armed = false
    let disarmId = 0

    const disarm = () => {
      armed = false
      if (disarmId) {
        clearTimeout(disarmId)
        disarmId = 0
      }
      btn.remove_css_class("armed")
      icon.label = action.icon
    }

    const fire = () => {
      disarm()
      if (action.preClose) closeSidebar()
      execAsync(action.cmd).catch(() => {})
    }

    btn.connect("clicked", () => {
      if (!action.confirm || armed) {
        fire()
        return
      }
      armed = true
      btn.add_css_class("armed")
      icon.label = ARMED_ICON
      disarmId = setTimeout(disarm, 3000)
    })

    row.append(btn)
  }

  return row
}
