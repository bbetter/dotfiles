import { exec } from "ags/process"
import { createPoll } from "ags/time"
import { Gtk } from "ags/gtk4"

interface SidebarNotificationsState {
  count: number
  dnd: boolean
}

export function SidebarNotifications() {
  const state = createPoll<SidebarNotificationsState>(
    { count: 0, dnd: false },
    2000,
    () => {
      try {
        const count = Number.parseInt(exec("swaync-client -c -sw").trim(), 10)
        const dnd = exec("swaync-client -D -sw").trim().toLowerCase() === "true"
        return {
          count: Number.isFinite(count) ? count : 0,
          dnd,
        }
      } catch {
        return { count: 0, dnd: false }
      }
    },
  )

  return (
    <box orientation={1} spacing={6} class="sidebar-section">
      <label label="NOTIFICATIONS" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box orientation={1} spacing={8} class="sidebar-card">
        <box class="sidebar-row">
          <label label="UNREAD" class="sidebar-row-label" />
          <label
            label={state.as(s => `${s.count}`)}
            class={state.as(s => `sidebar-row-value${s.count > 0 ? " sidebar-attention" : ""}`)}
            hexpand
            halign={Gtk.Align.END}
          />
        </box>
        <box class="sidebar-row">
          <label label="MODE" class="sidebar-row-label" />
          <label
            label={state.as(s => s.dnd ? "Do not disturb" : "Delivering alerts")}
            class="sidebar-row-value"
            hexpand
            halign={Gtk.Align.END}
          />
        </box>
        <box spacing={8}>
          <button
            class="sidebar-action"
            onClicked={() => {
              try {
                exec("swaync-client -op -sw")
              } catch {
                // Ignore if unavailable.
              }
            }}
          >
            <label label="Open Panel" />
          </button>
          <button
            class="sidebar-action"
            onClicked={() => {
              try {
                exec("swaync-client -C -sw")
              } catch {
                // Ignore if unavailable.
              }
            }}
          >
            <label label="Read All" />
          </button>
          <button
            class="sidebar-action"
            onClicked={() => {
              try {
                exec("swaync-client -d -sw")
              } catch {
                // Ignore if unavailable.
              }
            }}
          >
            <label label={state.as(s => s.dnd ? "Disable DND" : "Enable DND")} />
          </button>
        </box>
      </box>
    </box>
  )
}
