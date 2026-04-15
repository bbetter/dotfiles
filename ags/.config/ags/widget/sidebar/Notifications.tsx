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

  const container = new Gtk.Box({ 
    orientation: Gtk.Orientation.VERTICAL, 
    spacing: 6,
    visible: false
  })
  container.add_css_class("sidebar-notifications-list")

  const update = () => {
    let child = container.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      container.remove(child)
      child = next
    }

    const notifications = notifd.get_notifications()
    container.visible = notifications.length > 0

    if (notifications.length > 0) {
      const sep = new Gtk.Box()
      sep.add_css_class("sidebar-separator")
      container.append(sep)

      const header = new Gtk.Box({ hexpand: true })
      const title = new Gtk.Label({ label: "NOTIFICATIONS", halign: Gtk.Align.START, hexpand: true })
      title.add_css_class("sidebar-section-title")
      
      const clearBtn = new Gtk.Button({ label: "Clear All", halign: Gtk.Align.END })
      clearBtn.add_css_class("sidebar-notif-clear")
      clearBtn.connect("clicked", () => {
        notifd.get_notifications().forEach(n => n.dismiss())
      })

      header.append(title)
      header.append(clearBtn)
      container.append(header)
      
      // Group by App Name
      const groups = new Map<string, Notifd.Notification[]>()
      for (const n of notifications) {
        const app = n.appName || "Unknown"
        if (!groups.has(app)) groups.set(app, [])
        groups.get(app)!.push(n)
      }

      // Render latest 3 groups
      const sortedGroups = [...groups.entries()]
        .sort((a, b) => b[1][0].id - a[1][0].id)
        .slice(0, 3)

      for (const [appName, list] of sortedGroups) {
        if (list.length > 1) {
           const stackHeader = new Gtk.Box({ spacing: 6 })
           stackHeader.add_css_class("sidebar-notif-stack-header")
           
           const appLabel = new Gtk.Label({ 
             label: `${appName.toUpperCase()} (${list.length})`,
             halign: Gtk.Align.START 
           })
           appLabel.add_css_class("sidebar-notif-app-name")
           stackHeader.append(appLabel)
           container.append(stackHeader)
        }
        
        // Show only the latest notification from this app
        container.append(NotificationEntry({ notification: list[list.length - 1] }))
      }
    }
  }

  notifd.connect("notified", update)
  notifd.connect("resolved", update)
  update()

  return container
}
