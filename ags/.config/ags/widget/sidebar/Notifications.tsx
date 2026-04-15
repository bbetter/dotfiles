import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import { closeSidebar } from "./state"

interface SwayNCState {
  count: number
  dnd: boolean
}

async function getSwayncState(): Promise<SwayNCState> {
  try {
    const [countRaw, dndRaw] = await Promise.all([
      execAsync("swaync-client -c -sw"),
      execAsync("swaync-client -D -sw"),
    ])
    return {
      count: parseInt(countRaw.trim()) || 0,
      dnd: dndRaw.trim().toLowerCase() === "true",
    }
  } catch {
    return { count: 0, dnd: false }
  }
}

export function SidebarNotificationList() {
  const state = createPoll<SwayNCState>(
    { count: 0, dnd: false },
    3000,
    getSwayncState,
  )

  return (
    <box orientation={1} class="sidebar-section">
      <box class="sidebar-notifications-header" hexpand spacing={8}>
        <label
          label="NOTIFICATIONS"
          class="sidebar-section-title"
          hexpand
          halign={Gtk.Align.START}
        />
        <label
          label={state.as(s => s.count > 0 ? `${s.count}` : "")}
          class="sidebar-notifications-count-small"
          halign={Gtk.Align.END}
        />
        <button
          class="sidebar-notif-clear"
          visible={state.as(s => s.count > 0)}
          onClicked={() => execAsync("swaync-client -C -sw").catch(() => {})}
        >
          <label label="Clear" />
        </button>
      </box>

      <box spacing={8} marginTop={4} class="sidebar-notif-actions">
        <button
          class="sidebar-action"
          hexpand
          onClicked={() => {
            execAsync("swaync-client -op -sw").catch(() => {})
            closeSidebar()
          }}
        >
          <box spacing={10}>
            <label
              label={state.as(s => s.count > 0 ? "󰂚" : "󰂜")}
              class={state.as(s => `sidebar-action-title ${s.count > 0 ? "sidebar-attention" : "sidebar-muted"}`)}
            />
            <box orientation={1} hexpand>
              <label
                label={state.as(s =>
                  s.count > 0
                    ? `${s.count} notification${s.count === 1 ? "" : "s"}`
                    : "No notifications"
                )}
                class="sidebar-action-title"
                halign={Gtk.Align.START}
              />
              <label
                label="Open swaync panel →"
                class="sidebar-action-subtitle"
                halign={Gtk.Align.START}
              />
            </box>
          </box>
        </button>

        <button
          class={state.as(s => `sidebar-action ${s.dnd ? "sidebar-action-primary" : ""}`)}
          onClicked={() => execAsync("swaync-client -d -sw").catch(() => {})}
          tooltipText="Toggle Do Not Disturb"
        >
          <label
            label={state.as(s => s.dnd ? "󰂛" : "󰂚")}
            class={state.as(s => `sidebar-action-title ${s.dnd ? "sidebar-attention" : "sidebar-muted"}`)}
          />
        </button>
      </box>
    </box>
  )
}
