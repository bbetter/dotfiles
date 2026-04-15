import { createPoll } from "ags/time"
import { toggleCalendarPopup } from "../CalendarPopup"
import { Gtk } from "ags/gtk4"
import app from "ags/gtk4/app"

export function Clock() {
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

  app.observe_property("windows", (a) => {
    const win = a.get_window("calendar-popup")
    if (win) {
      win.observe_property("visible", (w) => {
        if (w.visible) btn.add_css_class("active")
        else btn.remove_css_class("active")
      })
    }
  })

  return btn
}
