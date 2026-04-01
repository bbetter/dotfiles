import Tray from "gi://AstalTray"
import { Gtk } from "ags/gtk4"

export function SystemTray() {
  const tray = Tray.get_default()
  
  const box = <box class="tray" spacing={4} /> as Gtk.Box
  
  // Функція додавання item за ID
  const addItem = (itemId: string) => {
    
    // Отримуємо справжній item об'єкт
    const item = tray.get_item(itemId)
    
    if (!item) {
      console.log("SystemTray: Item not found!")
      return
    }
    
    const btn = (
      <button
        tooltipMarkup={item.tooltipMarkup}
        onClicked={() => {
          item.activate(0, 0)
        }}
      >
        <image gicon={item.gicon} />
      </button>
    ) as Gtk.Widget
    
    box.append(btn)
  }
  
  // Слухаємо події
  tray.connect("item-added", (_, itemId) => {
    addItem(itemId)
  })
  
  // Додаємо існуючі items
  tray.get_items().forEach(addItem)
  
  return box
}