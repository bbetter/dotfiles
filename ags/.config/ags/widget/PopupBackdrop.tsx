import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { closeAllPopups } from "./PopupManager"

export function PopupBackdrop(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM, LEFT } = Astal.WindowAnchor
  const monitorName = gdkmonitor.get_connector() ?? `${gdkmonitor.get_model() ?? "monitor"}`

  const hitbox = <box hexpand vexpand /> as Gtk.Box
  hitbox.canTarget = true
  hitbox.sensitive = true
  const click = Gtk.GestureClick.new()
  click.connect("pressed", () => closeAllPopups())
  hitbox.add_controller(click)

  return (
    <window
      name={`popup-backdrop-${monitorName}`}
      visible={false}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      anchor={TOP | RIGHT | BOTTOM | LEFT}
      application={app}
      class="PopupBackdrop"
    >
      {hitbox}
    </window>
  )
}
