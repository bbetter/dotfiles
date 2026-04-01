import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { SIDEBAR_WIDTH } from "./Sidebar"
import { closeSidebar } from "./sidebar/state"

export function SidebarBackdrop(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM, LEFT } = Astal.WindowAnchor
  const monitorName = gdkmonitor.get_connector() ?? `${gdkmonitor.get_model() ?? "monitor"}`
  const hitbox = <box class="sidebar-backdrop-hitbox" hexpand vexpand /> as Gtk.Box
  hitbox.canTarget = true
  hitbox.sensitive = true
  const click = Gtk.GestureClick.new()
  click.connect("pressed", () => closeSidebar())
  hitbox.add_controller(click)

  return (
    <window
      name={`sidebar-backdrop-${monitorName}`}
      visible={false}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      anchor={TOP | RIGHT | BOTTOM | LEFT}
      marginRight={SIDEBAR_WIDTH}
      application={app}
      class="SidebarBackdrop"
    >
      {hitbox}
    </window>
  )
}
