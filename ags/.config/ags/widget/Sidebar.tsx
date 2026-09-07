import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { SidebarStatus } from "./sidebar/Status"
import { SidebarMedia } from "./sidebar/Media"
import { SidebarPeripherals } from "./sidebar/Peripherals"
import { SidebarJarvis } from "./sidebar/Jarvis"
import { SidebarAiUsage } from "./sidebar/AiUsage"
import { SystemUsage } from "./sidebar/SystemUsage"
import { SidebarNotificationList } from "./sidebar/Notifications"
import { closeSidebar } from "./sidebar/state"

export const SIDEBAR_WIDTH = 390

export function Sidebar(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM } = Astal.WindowAnchor
  const monitorName = gdkmonitor.get_connector() ?? `${gdkmonitor.get_model() ?? "monitor"}`

  const closeBtn = (
    <button class="sidebar-close" onClicked={closeSidebar}>
      <label label="✕" />
    </button>
  ) as Gtk.Button

  const win = (
    <window
      name={`sidebar-window-${monitorName}`}
      visible={false}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.EXCLUSIVE}
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
              {closeBtn}
            </box>
            {SidebarStatus()}
            {SidebarNotificationList()}
            {SystemUsage()}
            {SidebarMedia()}
            {SidebarPeripherals()}
            {SidebarJarvis()}
            {SidebarAiUsage()}
          </box>
        </scrolledwindow>
      </box>
    </window>
  ) as Gtk.Window

  // Esc closes the drawer. keymode EXCLUSIVE means the window holds the
  // keyboard while visible, so a capture-phase handler reliably sees the key.
  const keyCtl = new Gtk.EventControllerKey()
  keyCtl.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
  keyCtl.connect("key-pressed", (_c, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      closeSidebar()
      return true
    }
    return false
  })
  win.add_controller(keyCtl)

  win.connect("notify::visible", (w) => {
    if (w.visible) closeBtn.grab_focus()
  })

  return win
}
