import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"
import { Sidebar } from "./widget/Sidebar"
import { SidebarBackdrop } from "./widget/SidebarBackdrop"
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
    })
  },
})
