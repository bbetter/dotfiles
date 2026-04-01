import { exec } from "ags/process"
import { Gtk } from "ags/gtk4"

function launch(command: string) {
  try {
    exec(command)
  } catch {
    // Ignore missing apps.
  }
}

export function SidebarControls() {
  return (
    <box orientation={1} spacing={6} class="sidebar-section">
      <label label="QUICK SETTINGS" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box orientation={1} spacing={10} class="sidebar-card">
        <label
          label="Open the right config app directly instead of hunting through menus."
          class="sidebar-muted sidebar-lead"
          halign={Gtk.Align.START}
          wrap
        />
        <box spacing={8}>
          <button class="sidebar-action sidebar-action-primary" hexpand onClicked={() => launch("pavucontrol")}>
            <box orientation={1} spacing={2}>
              <label label="Audio" class="sidebar-action-title" halign={Gtk.Align.START} />
              <label label="pavucontrol" class="sidebar-action-subtitle" halign={Gtk.Align.START} />
            </box>
          </button>
          <button class="sidebar-action" hexpand onClicked={() => launch("nm-connection-editor")}>
            <box orientation={1} spacing={2}>
              <label label="Network" class="sidebar-action-title" halign={Gtk.Align.START} />
              <label label="connections" class="sidebar-action-subtitle" halign={Gtk.Align.START} />
            </box>
          </button>
          <button class="sidebar-action" hexpand onClicked={() => launch("sh -c 'blueman-manager || blueberry'")}>
            <box orientation={1} spacing={2}>
              <label label="Bluetooth" class="sidebar-action-title" halign={Gtk.Align.START} />
              <label label="device manager" class="sidebar-action-subtitle" halign={Gtk.Align.START} />
            </box>
          </button>
        </box>
      </box>
    </box>
  )
}
