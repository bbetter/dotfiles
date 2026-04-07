import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"

async function getLanguage(): Promise<string> {
  try {
    const output = await execAsync("hyprctl devices -j")
    const devices = JSON.parse(output)
    const keyboard = devices.keyboards?.find((k: { main?: boolean }) => k.main) || devices.keyboards?.[0]
    if (!keyboard) return "unknown"
    const layouts = keyboard.layout.split(",")
    const activeLayout = layouts[keyboard.active_layout_index] ?? ""
    if (activeLayout === "us") return "EN"
    if (activeLayout === "ua") return "UA"
    return activeLayout.toUpperCase()
  } catch {
    return "?"
  }
}

interface StatusState {
  language: string
  date: string
  time: string
}

export function SidebarStatus() {
  const state = createPoll<StatusState>(
    { language: "?", date: "", time: "" },
    1000,
    async () => {
      const now = new Date()
      return {
        language: await getLanguage(),
        date: now.toLocaleDateString("uk-UA", { weekday: "short", day: "2-digit", month: "short" }),
        time: now.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }),
      }
    },
  )

  return (
    <box orientation={1} spacing={4} class="sidebar-card sidebar-hero-card">
      <box>
        <label label={state.as(s => s.time)} class="sidebar-time" hexpand halign={Gtk.Align.START} />
        <label label={state.as(s => s.language)} class="sidebar-layout-badge" halign={Gtk.Align.END} />
      </box>
      <label label={state.as(s => s.date)} class="sidebar-date" halign={Gtk.Align.START} />
    </box>
  )
}
