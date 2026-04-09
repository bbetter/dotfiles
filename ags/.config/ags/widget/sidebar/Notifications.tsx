import Notifd from "gi://AstalNotifd"
import { Gtk } from "ags/gtk4"

function NotificationEntry({ notification }: { notification: Notifd.Notification }) {
  const icon = notification.appIcon || notification.appEntry || "dialog-information"
  
  return (
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

    const list = notifd.get_notifications().slice(-3).reverse()
    container.visible = list.length > 0

    if (list.length > 0) {
      const sep = new Gtk.Box()
      sep.add_css_class("sidebar-separator")
      container.append(sep)

      const title = new Gtk.Label({ 
        label: "NOTIFICATIONS", 
        halign: Gtk.Align.START 
      })
      title.add_css_class("sidebar-section-title")
      container.append(title)
      
      for (const n of list) {
        container.append(NotificationEntry({ notification: n }))
      }
    }
  }

  notifd.connect("notified", update)
  notifd.connect("resolved", update)
  update()

  return container
}
