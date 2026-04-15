import { createPoll } from "ags/time"
import { toggleCalendarPopup } from "../CalendarPopup"
import { Gtk, Gdk } from "ags/gtk4"
import app from "ags/gtk4/app"

export function Clock({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const monitorName = gdkmonitor.get_connector() ?? "default"
  const time = createPoll("", 1000, () => {
    const now = new Date()
    return now.toLocaleTimeString("uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
    }) + "  " + now.toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  })

  const btn = (
    <button 
      class="clock" 
      tooltipText={time}
      onClicked={() => toggleCalendarPopup(btn)}
    >
      <label label={time} />
    </button>
  ) as Gtk.Button

  setTimeout(() => {
    const winName = `calendar-popup-${monitorName}`
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
