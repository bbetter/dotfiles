import { createBinding, createComputed } from "gnim"
import Hyprland from "gi://AstalHyprland"

const APP_REWRITES: Record<string, string> = {
  "firefox":  "󰈹 Firefox",
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

  // Nested bindings re-attach to the new focused client automatically and also
  // fire on that client's title/class changes — no polling.
  const titleB = createBinding(hypr, "focusedClient", "title")
  const classB = createBinding(hypr, "focusedClient", "class")

  const state = createComputed(() => {
    const t = titleB()
    if (!t) return { text: "", visible: false }
    return { text: rewrite(t, classB() ?? ""), visible: true }
  })

  return (
    <label
      class="window-title"
      label={state.as(s => s.text)}
      visible={state.as(s => s.visible)}
    />
  )
}
