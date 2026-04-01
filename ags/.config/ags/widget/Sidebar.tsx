import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import { SidebarStatus } from "./sidebar/Status"
import { SidebarNotifications } from "./sidebar/Notifications"
import { SidebarMedia } from "./sidebar/Media"
import { SidebarUpdates } from "./sidebar/Updates"
import { SidebarPeripherals } from "./sidebar/Peripherals"
import { SidebarActivity } from "./sidebar/Activity"
import { SidebarJarvis } from "./sidebar/Jarvis"
import { closeSidebar } from "./sidebar/state"

export const SIDEBAR_WIDTH = 390

function clearChildren(box: Gtk.Box) {
  let child = box.get_first_child()
  while (child) {
    const next = child.get_next_sibling()
    box.remove(child)
    child = next
  }
}

function setSlotChild(slot: Gtk.Box, child: Gtk.Widget) {
  clearChildren(slot)
  slot.append(child)
}

function createPlaceholder(title: string, lines = 2) {
  const placeholder = (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={6} class="sidebar-section">
      <label label={title} class="sidebar-section-title" halign={Gtk.Align.START} />
      <box orientation={Gtk.Orientation.VERTICAL} spacing={8} class="sidebar-card sidebar-card-loading">
        {Array.from({ length: lines }, (_, index) => (
          <box
            class={index === lines - 1 ? "sidebar-placeholder-line sidebar-placeholder-short" : "sidebar-placeholder-line"}
          />
        ))}
      </box>
    </box>
  ) as Gtk.Box

  return placeholder
}

export function Sidebar(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM } = Astal.WindowAnchor
  const monitorName = gdkmonitor.get_connector() ?? `${gdkmonitor.get_model() ?? "monitor"}`
  const statusSlot = <box orientation={Gtk.Orientation.VERTICAL} /> as Gtk.Box
  const notificationsSlot = <box orientation={Gtk.Orientation.VERTICAL} /> as Gtk.Box
  const mediaSlot = <box orientation={Gtk.Orientation.VERTICAL} /> as Gtk.Box
  const updatesSlot = <box orientation={Gtk.Orientation.VERTICAL} /> as Gtk.Box
  const peripheralsSlot = <box orientation={Gtk.Orientation.VERTICAL} /> as Gtk.Box
  const activitySlot = <box orientation={Gtk.Orientation.VERTICAL} /> as Gtk.Box
  const jarvisSlot = <box orientation={Gtk.Orientation.VERTICAL} /> as Gtk.Box

  setSlotChild(statusSlot, createPlaceholder("OVERVIEW", 3))
  setSlotChild(notificationsSlot, createPlaceholder("NOTIFICATIONS"))
  setSlotChild(mediaSlot, createPlaceholder("NOW PLAYING", 3))
  setSlotChild(updatesSlot, createPlaceholder("UPDATES"))
  setSlotChild(peripheralsSlot, createPlaceholder("DEVICES", 3))
  setSlotChild(activitySlot, createPlaceholder("ACTIVITY"))
  setSlotChild(jarvisSlot, createPlaceholder("JARVIS", 2))

  const content = (
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
      {statusSlot}
      {mediaSlot}
      {activitySlot}
      {notificationsSlot}
      {updatesSlot}
      {peripheralsSlot}
      {jarvisSlot}
    </box>
  ) as Gtk.Box

  const scroller = (
    <scrolledwindow
      vexpand
      hscrollbarPolicy={Gtk.PolicyType.NEVER}
      vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
    >
      {content}
    </scrolledwindow>
  ) as Gtk.ScrolledWindow

  const win = (
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
      {scroller}
    </window>
  ) as Gtk.Window

  let initialized = false

  win.connect("notify::visible", () => {
    if (win.visible && !initialized) {
      initialized = true

      const stages: Array<[number, Gtk.Box, () => Gtk.Widget]> = [
        [20, statusSlot, () => SidebarStatus() as Gtk.Widget],
        [60, mediaSlot, () => SidebarMedia() as Gtk.Widget],
        [120, activitySlot, () => SidebarActivity() as Gtk.Widget],
        [180, notificationsSlot, () => SidebarNotifications() as Gtk.Widget],
        [260, peripheralsSlot, () => SidebarPeripherals() as Gtk.Widget],
        [340, updatesSlot, () => SidebarUpdates() as Gtk.Widget],
        [420, jarvisSlot, () => SidebarJarvis() as Gtk.Widget],
      ]

      for (const [delay, slot, factory] of stages) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
          setSlotChild(slot, factory())
          return GLib.SOURCE_REMOVE
        })
      }
    }
  })

  return win
}
