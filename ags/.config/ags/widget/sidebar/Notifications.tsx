import Notifd from "gi://AstalNotifd"
import { Gtk } from "ags/gtk4"

function NotificationEntry({ notification }: { notification: Notifd.Notification }) {
  const icon = notification.appIcon || notification.appEntry || "dialog-information"
  
  const actions = notification.actions || []
  const actionRow = new Gtk.Box({ spacing: 6 })
  actionRow.add_css_class("notification-actions")
  
  for (const action of actions) {
    const btn = new Gtk.Button({ label: action.label })
    btn.add_css_class("notification-action-btn")
    btn.connect("clicked", () => notification.invoke(action.id))
    actionRow.append(btn)
  }

  return (
    <box orientation={1} class="notification-entry-wrapper">
      <box class="notification-entry" spacing={8}>
        <Gtk.Image 
          iconName={icon} 
          pixelSize={32}
          valign={Gtk.Align.START}
          visible={!!icon}
        />
        <box orientation={1} hexpand>
          <box>
            <label 
              label={notification.summary || "Notification"} 
              class="notification-summary" 
              halign={Gtk.Align.START} 
              ellipsize={3}
              hexpand
            />
            <button 
              class="notification-close" 
              onClicked={() => notification.dismiss()}
            >
              <label label="✕" />
            </button>
          </box>
          <label 
            label={notification.body || ""} 
            class="notification-body" 
            halign={Gtk.Align.START} 
            wrap
            maxWidthChars={30}
          />
          {actions.length > 0 && actionRow}
        </box>
      </box>
    </box>
  )
}

export function SidebarNotificationList() {
  const notifd = Notifd.get_default()
  if (!notifd) return <box />

  const outer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  const listContainer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6 })
  
  const revealer = new Gtk.Revealer({
    child: listContainer,
    transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transition_duration: 250,
    reveal_child: false,
  })

  const header = new Gtk.Box({ hexpand: true, spacing: 8 })
  header.add_css_class("sidebar-notifications-header")
  
  const title = new Gtk.Label({ label: "NOTIFICATIONS", halign: Gtk.Align.START, hexpand: true })
  title.add_css_class("sidebar-section-title")
  
  const countLabel = new Gtk.Label({ label: "0", halign: Gtk.Align.END })
  countLabel.add_css_class("sidebar-notifications-count-small")
  
  const toggleBtn = new Gtk.Button()
  toggleBtn.add_css_class("sidebar-notif-toggle")
  const toggleLabel = new Gtk.Label({ label: "Expand 󰅀" })
  toggleBtn.set_child(toggleLabel)
  
  toggleBtn.connect("clicked", () => {
    revealer.reveal_child = !revealer.reveal_child
    toggleLabel.label = revealer.reveal_child ? "Collapse 󰅃" : "Expand 󰅀"
  })

  const clearBtn = new Gtk.Button({ label: "Clear" })
  clearBtn.add_css_class("sidebar-notif-clear")
  clearBtn.connect("clicked", () => {
    notifd.get_notifications().forEach(n => n.dismiss())
  })

  header.append(title)
  header.append(countLabel)
  header.append(clearBtn)
  header.append(toggleBtn)
  
  outer.append(header)
  outer.append(revealer)

  const update = () => {
    let child = listContainer.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      listContainer.remove(child)
      child = next
    }

    const notifications = notifd.get_notifications()
    const count = notifications.length
    countLabel.label = count > 0 ? `${count}` : ""
    clearBtn.visible = count > 0
    toggleBtn.visible = count > 0

    if (count > 0) {
      // Group by App Name
      const groups = new Map<string, Notifd.Notification[]>()
      for (const n of notifications) {
        const app = n.appName || "Unknown"
        if (!groups.has(app)) groups.set(app, [])
        groups.get(app)!.push(n)
      }

      for (const [appName, list] of groups) {
        const stackHeader = new Gtk.Box({ spacing: 6 })
        stackHeader.add_css_class("sidebar-notif-stack-header")

        const appLabel = new Gtk.Label({
          label: `${appName.toUpperCase()} (${list.length})`,
          halign: Gtk.Align.START
        })
        appLabel.add_css_class("sidebar-notif-app-name")
        stackHeader.append(appLabel)
        listContainer.append(stackHeader)

        for (const n of list) {
          listContainer.append(NotificationEntry({ notification: n }))
        }
      }
    } else {
      revealer.reveal_child = false
      toggleLabel.label = "Expand 󰅀"
    }
  }

  notifd.connect("notified", update)
  notifd.connect("resolved", update)
  update()

  return (
    <box orientation={1} class="sidebar-section">
      {outer}
    </box>
  )
}
