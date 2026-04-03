import { exec, execAsync } from "ags/process"
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
    async () => {
      try {
        const count = Number.parseInt((await execAsync("swaync-client -c -sw")).trim(), 10)
        const dnd = (await execAsync("swaync-client -D -sw")).trim().toLowerCase() === "true"
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
      <box orientation={1} spacing={10} class="sidebar-card sidebar-notifications-card">
        <box class="sidebar-notifications-header">
          <box orientation={1} spacing={2}>
            <label
              label={state.as(s => `${s.count}`)}
              class={state.as(s => `sidebar-notifications-count${s.count > 0 ? " sidebar-attention" : ""}`)}
              halign={Gtk.Align.START}
            />
            <label
              label={state.as(s => s.count === 1 ? "unread alert" : "unread alerts")}
              class="sidebar-summary-title"
              halign={Gtk.Align.START}
            />
          </box>
          <label
            label={state.as(s => s.dnd ? "Do not disturb is on" : (s.count > 0 ? "Attention needed" : "All caught up"))}
            class="sidebar-muted"
            halign={Gtk.Align.START}
          />
        </box>
        <box class="sidebar-row">
          <label label="MODE" class="sidebar-row-label" />
          <label
            label={state.as(s => s.dnd ? "Muted" : "Delivering alerts")}
            class="sidebar-row-value"
            hexpand
            halign={Gtk.Align.END}
          />
        </box>
        <box spacing={8} homogeneous>
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
            class="sidebar-action sidebar-action-primary"
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
