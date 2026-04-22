import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { Audio } from "./bar/Audio"
import { BluetoothIndicator } from "./bar/Bluetooth"
import { RecordingStatus } from "./bar/Recording"
import { NetworkIndicator } from "./bar/Network"
import { Workspaces } from "./bar/Workspaces"
import { Clock } from "./bar/Clock"
import { WindowTitle } from "./bar/WindowTitle"
import { SidebarToggle } from "./bar/SidebarToggle"
import { Language } from "./bar/Language"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  const monitorName = gdkmonitor.get_connector() ?? `${gdkmonitor.get_model() ?? "monitor"}`

  return (
    <window
      visible
      name={`bar-${monitorName}`}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      layer={Astal.Layer.TOP}
      anchor={TOP | LEFT | RIGHT}
      application={app}
      class="Bar"
    >
      <centerbox class="bar-content">
        <box $type="start" hexpand halign={Gtk.Align.START} spacing={0}>
          <Clock gdkmonitor={gdkmonitor} />
          <WindowTitle />
        </box>

        <box $type="center" hexpand halign={Gtk.Align.CENTER}>
          <Workspaces gdkmonitor={gdkmonitor} />
        </box>

        <box $type="end" hexpand halign={Gtk.Align.END} spacing={0}>
          <Audio gdkmonitor={gdkmonitor} />
          <BluetoothIndicator gdkmonitor={gdkmonitor} />
          <NetworkIndicator gdkmonitor={gdkmonitor} />
          <Language />
          <RecordingStatus />
          <SidebarToggle gdkmonitor={gdkmonitor} />
        </box>
      </centerbox>
    </window>
  )
}
