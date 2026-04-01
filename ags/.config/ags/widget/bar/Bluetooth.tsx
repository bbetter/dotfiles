import { createPoll } from "ags/time"
import Bluetooth from "gi://AstalBluetooth"

export function BluetoothIndicator() {
  const bt = Bluetooth.get_default()
  
  const btText = createPoll("", 500, () => {
    
    if (!bt.isPowered) {
      return "" // Не показуємо якщо вимкнено
    }
    
    const devices = bt.get_devices()
    
    const connected = devices.filter(d => d.connected)
    
    if (connected.length > 0) {
      const device = connected[0]
      return `ᛒ ${device.name}`
    }
    
    return "ᛒ"
  })
  
  const isVisible = createPoll(false, 500, () => {
    return bt.isPowered || bt.get_devices().filter(d => d.connected).length > 0
  })

  return (
    <button 
      class="bluetooth"
      visible={isVisible}
    >
      <label label={btText} />
    </button>
  )
}