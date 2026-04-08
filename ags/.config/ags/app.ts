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

    res(`unknown request: ${argv.join(" ")}`)
  },
  main() {
    app.get_monitors().map(monitor => {
      Bar(monitor)
      SidebarBackdrop(monitor)
      Sidebar(monitor)
      PopupBackdrop(monitor)   // must be before popup windows (z-below them)
      NetworkPopup(monitor)
      AudioPopup(monitor)
      BluetoothPopup(monitor)
      CalendarPopup(monitor)
    })
  },
})
