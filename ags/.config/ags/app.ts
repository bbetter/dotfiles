import app from "ags/gtk4/app"
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
    
    const monitors = app.get_monitors()

    // Initialize bars and sidebars immediately (visible on startup)
    monitors.forEach(monitor => {
      const mStart = Date.now()
      Bar(monitor)
      SidebarBackdrop(monitor)
      Sidebar(monitor)
      console.log(`AGS: Bar+Sidebar for ${monitor.get_connector() || "unknown"} in ${Date.now() - mStart}ms`)
    })

    // Defer popup windows — they start hidden, no need to block initial render
    setTimeout(() => {
      monitors.forEach(monitor => {
        PopupBackdrop(monitor)
        NetworkPopup(monitor)
        AudioPopup(monitor)
        BluetoothPopup(monitor)
        CalendarPopup(monitor)
      })
      console.log(`AGS: Popups initialized in ${Date.now() - startTime}ms total`)
    }, 0)

    console.log(`AGS: Total startup time: ${Date.now() - startTime}ms`)
  },
})
