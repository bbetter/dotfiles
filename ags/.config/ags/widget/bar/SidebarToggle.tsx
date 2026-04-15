import { exec } from "ags/process"
import { createPoll } from "ags/time"
import { toggleSidebar } from "../sidebar/state"
import { Gdk } from "ags/gtk4"

export function SidebarToggle({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const hasNotifications = createPoll(false, 1000, () => {
    try {
      const count = Number.parseInt(exec("swaync-client -c -sw").trim(), 10)
      return Number.isFinite(count) && count > 0
    } catch {
      return false
    }
  })

  return (
    <button class="sidebar-toggle" onClicked={() => toggleSidebar(gdkmonitor)}>
      <box spacing={6}>
        <label label="☰" />
        <label
          class="sidebar-toggle-alert"
          label="●"
          visible={hasNotifications}
        />
      </box>
    </button>
  )
}
