import app from "ags/gtk4/app"
import { Gdk } from "ags/gtk4"
import style from "./style.scss"
import Bar from "./widget/Bar"
import { Sidebar } from "./widget/Sidebar"
import { SidebarBackdrop } from "./widget/SidebarBackdrop"
import { NetworkPopup } from "./widget/NetworkPopup"
import { AudioPopup } from "./widget/AudioPopup"
import { BluetoothPopup } from "./widget/BluetoothPopup"
import { CalendarPopup } from "./widget/CalendarPopup"
import { PopupBackdrop } from "./widget/PopupBackdrop"
import { closeSidebar, openSidebar, toggleSidebar } from "./widget/sidebar/state"

const startTime = Date.now()

function initWindows(monitor: Gdk.Monitor) {
  const mStart = Date.now()
  const connector = monitor.get_connector() || "unknown"
  console.log(`AGS: Initializing windows for ${connector}`)
  
  Bar(monitor)
  SidebarBackdrop(monitor)
  Sidebar(monitor)
  PopupBackdrop(monitor)
  NetworkPopup(monitor)
  AudioPopup(monitor)
  BluetoothPopup(monitor)
  CalendarPopup(monitor)
  
  console.log(`AGS: Windows for ${connector} initialized in ${Date.now() - mStart}ms`)
}

app.start({
  css: style,
  requestHandler(argv, res) {
    if (argv[0] === "sidebar") {
      const action = argv[1] ?? "toggle"
      if (action === "open") openSidebar()
      else if (action === "close") closeSidebar()
      else toggleSidebar()
      res("ok")
      return
    }

    if (argv[0] === "reload") {
      res("ok")
      setTimeout(() => app.quit(), 100)
      return
    }

    res(`unknown request: ${argv.join(" ")}`)
  },
  main() {
    console.log("AGS: Starting window initialization...")
    
    // Initialize for existing monitors
    const monitors = app.get_monitors()
    console.log(`AGS: Found ${monitors.length} monitor(s)`)
    monitors.forEach(monitor => initWindows(monitor))

    // Handle monitor changes
    const display = Gdk.Display.get_default()
    const monitorsList = display?.get_monitors()
    monitorsList?.connect("items-changed", (list, position, removed, added) => {
      if (added > 0) {
        for (let i = 0; i < added; i++) {
          const monitor = list.get_item(position + i) as Gdk.Monitor
          console.log(`AGS: Monitor added: ${monitor.get_connector()}`)
          initWindows(monitor)
        }
      }
    })

    console.log(`AGS: Total startup time: ${Date.now() - startTime}ms`)
  },
})
