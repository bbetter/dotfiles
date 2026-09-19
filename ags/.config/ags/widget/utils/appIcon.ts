import GioUnix from "gi://GioUnix"
import { Gtk, Gdk } from "ags/gtk4"

/** Icon for a window class: the .desktop entry's icon first, then a theme icon by name. */
export function appIcon(cls: string, size = 18): Gtk.Image {
  const img = new Gtk.Image({ pixelSize: size })
  const lower = cls.toLowerCase()
  const info =
    GioUnix.DesktopAppInfo.new(`${cls}.desktop`) ?? GioUnix.DesktopAppInfo.new(`${lower}.desktop`)
  const gicon = info?.get_icon()
  if (gicon) {
    img.set_from_gicon(gicon)
    return img
  }
  const display = Gdk.Display.get_default()
  const theme = display ? Gtk.IconTheme.get_for_display(display) : null
  const guess = lower.includes("ghostty") || lower.includes("terminal") ? "utilities-terminal" : lower
  img.set_from_icon_name(theme?.has_icon(guess) ? guess : "application-x-executable")
  return img
}

/** "com.mitchellh.ghostty" -> "Ghostty": the desktop entry's name, else a tidied class. */
export function appName(cls: string, cmd = ""): string {
  const info = GioUnix.DesktopAppInfo.new(`${cls}.desktop`) ?? GioUnix.DesktopAppInfo.new(`${cls.toLowerCase()}.desktop`)
  const name = info?.get_display_name()
  if (name) return name
  const known: Record<string, string> = {
    "jetbrains-studio": "Android Studio",
    "jetbrains-idea": "IntelliJ IDEA",
    "com.mitchellh.ghostty": "Ghostty",
    "org.telegram.desktop": "Telegram",
    code: "VS Code",
  }
  if (known[cls.toLowerCase()]) return known[cls.toLowerCase()]
  const raw = (cls || cmd.split(" ")[0].split("/").pop() || "window").replace(/^jetbrains-/, "")
  const base = raw.includes(".") ? raw.split(".").pop()! : raw
  return base.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}
