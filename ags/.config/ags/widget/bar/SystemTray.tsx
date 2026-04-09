import Tray from "gi://AstalTray"
import { Gtk } from "ags/gtk4"

export function SystemTray() {
  const tray = Tray.get_default()

  const box = <box class="tray" spacing={4} /> as Gtk.Box
  const buttons = new Map<string, Gtk.Widget>()

  const addItem = (itemId: string) => {
    if (buttons.has(itemId)) return
    const item = tray.get_item(itemId)
    if (!item) return

    const btn = (
      <button
        tooltipMarkup={item.bind("tooltip-markup")}
        onClicked={() => item.activate(0, 0)}
      >
        <image gicon={item.bind("gicon")} pixelSize={16} />
      </button>
    ) as Gtk.Widget

    buttons.set(itemId, btn)
    box.append(btn)
  }

  const removeItem = (itemId: string) => {
    const btn = buttons.get(itemId)
    if (btn) {
      box.remove(btn)
      buttons.delete(itemId)
    }
  }

  tray.connect("item-added", (_, itemId) => addItem(itemId))
  tray.connect("item-removed", (_, itemId) => removeItem(itemId))
  tray.get_items().forEach(addItem)

  return box
}