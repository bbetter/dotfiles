import { exec } from "ags/process"
import { createPoll } from "ags/time"
import { toggleSidebar } from "../sidebar/state"

export function SidebarToggle() {
  const hasNotifications = createPoll(false, 1000, () => {
    try {
      const count = Number.parseInt(exec("swaync-client -c -sw").trim(), 10)
      return Number.isFinite(count) && count > 0
    } catch {
      return false
    }
  })

  return (
    <button class="sidebar-toggle" onClicked={toggleSidebar}>
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
