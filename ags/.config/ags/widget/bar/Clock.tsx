import { createPoll } from "ags/time"
import { toggleCalendarPopup } from "../CalendarPopup"
import { Gtk } from "ags/gtk4"

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

  return btn
}
