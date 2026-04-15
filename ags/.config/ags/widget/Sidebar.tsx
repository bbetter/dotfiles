import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { SidebarStatus } from "./sidebar/Status"
import { SidebarMedia } from "./sidebar/Media"
import { SidebarPeripherals } from "./sidebar/Peripherals"
import { SidebarAiUsage } from "./sidebar/AiUsage"
import { SystemUsage } from "./sidebar/SystemUsage"
import { SidebarNotificationList } from "./sidebar/Notifications"
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
    >
      <box
        class="sidebar-window-container"
        widthRequest={SIDEBAR_WIDTH}
        halign={Gtk.Align.END}
        hexpand={false}
      >
        <scrolledwindow
          vexpand
          hexpand={false}
          hscrollbarPolicy={Gtk.PolicyType.NEVER}
          vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
          widthRequest={SIDEBAR_WIDTH}
          minContentWidth={SIDEBAR_WIDTH}
        >
          <box 
            orientation={Gtk.Orientation.VERTICAL} 
            spacing={12} 
            class="sidebar-content"
            widthRequest={SIDEBAR_WIDTH}
            hexpand={false}
            halign={Gtk.Align.FILL}
          >
            <box class="sidebar-header" hexpand={false}>
              <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                <label label="CONTROL CENTER" class="sidebar-title" halign={Gtk.Align.START} />
                <label 
                  label="extra status and quick checks" 
                  class="sidebar-subtitle" 
                  halign={Gtk.Align.START} 
                  wrap
                />
              </box>
              <button class="sidebar-close" onClicked={closeSidebar}>
                <label label="✕" />
              </button>
            </box>
            {SidebarStatus()}
            {SidebarNotificationList()}
            {SystemUsage()}
            {SidebarMedia()}
            {SidebarPeripherals()}
            {SidebarAiUsage()}
          </box>
        </scrolledwindow>
      </box>
    </window>
  ) as Gtk.Window
}
