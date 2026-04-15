import { Gtk, Gdk, Astal } from "ags/gtk4"
import { createPopup, PopupHandle } from "./BasePopup"

const _handles = new Map<Gdk.Monitor, PopupHandle>()

export function toggleCalendarPopup(sourceWidget?: Gtk.Widget) {
    const root = sourceWidget?.get_root() as any
    const monitor = root?.gdkmonitor || root?.monitor
    if (!monitor) return
    const handle = _handles.get(monitor)
    if (handle) handle.toggle(sourceWidget)
}

export function CalendarPopup(gdkmonitor: Gdk.Monitor) {
    const monitorName = gdkmonitor.get_connector() ?? "default"
    const calendar = new Gtk.Calendar()
    calendar.add_css_class("calendar-widget")

    const handle = createPopup({
        name: `calendar-popup-${monitorName}`,
        className: "CalendarPopup",
        baseClassName: "calendar-popup",
        gdkmonitor,
        anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT,
        defaultWidth: 240,
        child: calendar
    })

    _handles.set(gdkmonitor, handle)
    return handle.window
}
