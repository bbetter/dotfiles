import { toggleCalendarPopup } from "../CalendarPopup"
import { Gtk, Gdk } from "ags/gtk4"
import { bindActiveClass } from "../utils/popupActiveClass"
import { createMinuteClock } from "../utils/minuteClock"

interface ClockText {
  label: string
  tooltip: string
}

function snapshot(): ClockText {
  const now = new Date()
  return {
    label:
      now.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }) +
      "  " +
      now.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" }),
    // Tooltip carries what the pill omits: weekday + spelled-out month.
    tooltip: now.toLocaleDateString("uk-UA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }
}

export function Clock({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const monitorName = gdkmonitor.get_connector() ?? "default"

  const clock = createMinuteClock<ClockText>(snapshot)

  const btn = (
    <button
      class="clock"
      tooltipText={clock.as(c => c.tooltip)}
      onClicked={() => toggleCalendarPopup(btn)}
    >
      <label label={clock.as(c => c.label)} />
    </button>
  ) as Gtk.Button

  bindActiveClass(btn, "calendar-popup", monitorName)

  return btn
}
