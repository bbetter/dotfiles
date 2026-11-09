// StatusNotifier (SNI) items shown in the bar, filtered to JetBrains Toolbox.
//
// Toolbox has no other UI entry point in this setup: it lives in the system tray.
// AstalTray hosts the SNI items for us. Left click activates the item (Toolbox shows its
// window), right click opens the item's own DBusMenu (the same context menu as the tray).
import AstalTray from "gi://AstalTray"
import { Gtk } from "ags/gtk4"

// Match on item id (the SNI id Toolbox registers). Widen this pattern for other apps.
const WANTED = /jetbrains/i

// Toolbox ships its tray icon as a file next to the binary; the icon theme does not have it.
const TOOLBOX_ICON_FILE = "/opt/jetbrains-toolbox/toolbox-tray-color.png"

function makeIcon(item: AstalTray.TrayItem, button: Gtk.Button): Gtk.Image {
  const theme = Gtk.IconTheme.get_for_display(button.get_display())
  if (item.iconName && theme.has_icon(item.iconName)) {
    return new Gtk.Image({ iconName: item.iconName, pixelSize: 16 })
  }
  return Gtk.Image.new_from_file(TOOLBOX_ICON_FILE)
}

function openMenu(button: Gtk.Button, item: AstalTray.TrayItem) {
  const model = item.get_menu_model()
  if (!model) return
  const popover = Gtk.PopoverMenu.new_from_model(model)
  const actions = item.get_action_group()
  if (actions) popover.insert_action_group("dbusmenu", actions)
  popover.set_parent(button)
  popover.popup()
}

function makeButton(item: AstalTray.TrayItem): Gtk.Button {
  const button = new Gtk.Button({ cssClasses: ["tray-item", "toolbox-tray"] })
  button.set_child(makeIcon(item, button))
  button.set_tooltip_text(item.title || "JetBrains Toolbox")

  button.connect("clicked", () => {
    // Coordinates are only a hint for the item; Toolbox toggles its own window.
    item.activate(0, 0)
  })

  const right = new Gtk.GestureClick()
  right.set_button(3)
  right.connect("pressed", () => openMenu(button, item))
  button.add_controller(right)

  return button
}

export function Tray() {
  const box = new Gtk.Box({ spacing: 0, cssClasses: ["tray"] })
  const tray = AstalTray.get_default()
  const shown = new Map<string, Gtk.Button>()

  const add = (item: AstalTray.TrayItem) => {
    if (!WANTED.test(item.itemId ?? "") || shown.has(item.itemId)) return
    const button = makeButton(item)
    shown.set(item.itemId, button)
    box.append(button)
  }

  const remove = (id: string) => {
    const button = shown.get(id)
    if (!button) return
    box.remove(button)
    shown.delete(id)
  }

  for (const item of tray.get_items()) add(item)
  tray.connect("item-added", (_t: AstalTray.Tray, id: string) => {
    const item = tray.get_items().find(i => i.itemId === id)
    if (item) add(item)
  })
  tray.connect("item-removed", (_t: AstalTray.Tray, id: string) => remove(id))

  return box
}
