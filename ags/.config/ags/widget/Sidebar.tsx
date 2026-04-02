import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { closeSidebar } from "./sidebar/state"

export const SIDEBAR_WIDTH = 390

export function Sidebar(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM } = Astal.WindowAnchor
  const monitorName = gdkmonitor.get_connector() ?? `${gdkmonitor.get_model() ?? "monitor"}`

  return (
    <window
      name={`sidebar-window-${monitorName}`}
      visible={false}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      anchor={TOP | RIGHT | BOTTOM}
      application={app}
      class="Sidebar"
      widthRequest={SIDEBAR_WIDTH}
    >
      <scrolledwindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={12} class="sidebar-content">
          <box class="sidebar-header">
            <box orientation={Gtk.Orientation.VERTICAL} hexpand>
              <label label="CONTROL CENTER" class="sidebar-title" halign={Gtk.Align.START} />
              <label label="extra status and quick checks" class="sidebar-subtitle" halign={Gtk.Align.START} />
            </box>
            <button class="sidebar-close" onClicked={closeSidebar}>
              <label label="✕" />
            </button>
          </box>
        </box>
      </scrolledwindow>
    </window>
  ) as Gtk.Window
}
