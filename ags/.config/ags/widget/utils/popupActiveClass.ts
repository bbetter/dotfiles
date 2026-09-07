import app from "ags/gtk4/app"
import { Gtk } from "ags/gtk4"

/**
 * Mirror a popup window's visibility onto the `.active` CSS class of the bar
 * button that opens it. The popup window is looked up by
 * `${popupBaseName}-${monitorName}` once GTK has had a chance to create it.
 *
 * Replaces the identical setTimeout + notify::visible block that used to live
 * in Clock / Audio / Bluetooth / Network.
 */
export function bindActiveClass(
  btn: Gtk.Widget,
  popupBaseName: string,
  monitorName: string,
) {
  setTimeout(() => {
    const winName = `${popupBaseName}-${monitorName}`
    const win = app.get_windows().find(w => w.name === winName)
    if (!win) return
    win.connect("notify::visible", (w) => {
      if (w.visible) btn.add_css_class("active")
      else btn.remove_css_class("active")
    })
    if (win.visible) btn.add_css_class("active")
  }, 500)
}
