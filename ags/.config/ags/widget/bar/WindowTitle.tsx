import { createPoll } from "ags/time"
import Hyprland from "gi://AstalHyprland"

const APP_REWRITES: Record<string, string> = {
  "firefox":  "🌐",
  "code":     " Code",
  "thunar":   " Files",
  "kitty":    " Terminal",
  "ghostty":  " Terminal",
}

function rewrite(title: string, wm_class: string): string {
  const cls = wm_class.toLowerCase()
  for (const [key, label] of Object.entries(APP_REWRITES)) {
    if (cls.includes(key)) return label
  }
  return title.length > 50 ? title.slice(0, 47) + "…" : title
}

export function WindowTitle() {
  const hypr = Hyprland.get_default()

  const state = createPoll({ text: "", visible: false }, 500, () => {
    if (!hypr) return { text: "", visible: false }
    const win = hypr.focusedClient
    if (!win?.title) return { text: "", visible: false }
    return { text: rewrite(win.title, win["class"] as string), visible: true }
  })

  return (
    <label
      class="window-title"
      label={state.as(s => s.text)}
      visible={state.as(s => s.visible)}
    />
  )
}
