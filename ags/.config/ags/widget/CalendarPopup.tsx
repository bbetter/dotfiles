import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { closeAllPopups, updateBackdrop } from "./PopupManager"
import { closeSidebar } from "./sidebar/state"

const POPUP_WIDTH = 240
const ARROW_WIDTH = 20

const _popups = new Map<Gdk.Monitor, Gtk.Window>()
const _revealers = new Map<Gdk.Monitor, Gtk.Revealer>()
const _arrows = new Map<Gdk.Monitor, Gtk.Box>()

function positionUnder(popup: Gtk.Window, monitor: Gdk.Monitor, arrowEl: Gtk.Box, sourceWidget: Gtk.Widget) {
  const root = sourceWidget.get_root() as any
  if (!root) return
  const [ok, bx] = sourceWidget.translate_coordinates(root, 0, 0)
  if (!ok) return

  const bw = sourceWidget.get_allocated_width()
  const btnCenterX = bx + bw / 2
  const monitorWidth = monitor.get_geometry().width

  const marginLeft = Math.max(4, Math.min(
    monitorWidth - POPUP_WIDTH - 4,
    Math.max(4, btnCenterX - POPUP_WIDTH / 2)
  ))
  
  ;(popup as any).marginLeft = marginLeft

  if (arrowEl) {
    const btnWithinPopup = btnCenterX - marginLeft
    arrowEl.set_margin_start(Math.max(4, Math.round(btnWithinPopup - ARROW_WIDTH / 2)))
  }
}

export function toggleCalendarPopup(sourceWidget?: Gtk.Widget) {
  const monitor = (sourceWidget?.get_root() as any)?.gdkmonitor as Gdk.Monitor | undefined
  if (!monitor) return

  const popup = _popups.get(monitor)
  const revealer = _revealers.get(monitor)
  if (!popup || !revealer) return

  if (popup.visible && revealer.revealChild) {
    revealer.revealChild = false
    setTimeout(() => {
      // Check if it's still hidden before hiding window
      if (!revealer.revealChild) {
        popup.visible = false
        updateBackdrop()
      }
    }, 200)
  } else {
    closeSidebar()
    closeAllPopups(popup)
    const arrow = _arrows.get(monitor)
    if (sourceWidget && arrow) positionUnder(popup, monitor, arrow, sourceWidget)
    popup.visible = true
    revealer.revealChild = true
    updateBackdrop()
  }
}

export function CalendarPopup(gdkmonitor: Gdk.Monitor) {
  const calendar = new Gtk.Calendar()
  calendar.add_css_class("calendar-widget")

  const arrowEl = new Gtk.Box()
  arrowEl.add_css_class("calendar-popup-arrow")

  const revealer = new Gtk.Revealer({
    transitionType: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transitionDuration: 200,
    child: (
      <box orientation={1} class="calendar-popup-outer">
        <box class="calendar-popup-arrow-row">
          {arrowEl}
        </box>
        <box orientation={1} class="calendar-popup-content">
          {calendar}
        </box>
      </box>
    ) as Gtk.Widget
  })

  const { TOP, LEFT } = Astal.WindowAnchor

  const win = (
    <window
      name="calendar-popup"
      visible={false}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      anchor={TOP | LEFT}
      application={app}
      class="CalendarPopup"
      marginTop={4}
      marginLeft={8}
      widthRequest={POPUP_WIDTH}
    >
      {revealer}
    </window>
  ) as Gtk.Window

  _popups.set(gdkmonitor, win)
  _revealers.set(gdkmonitor, revealer)
  _arrows.set(gdkmonitor, arrowEl)
  return win
}
