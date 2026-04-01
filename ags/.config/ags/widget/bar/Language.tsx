import { createPoll } from "ags/time"
import { exec } from "ags/process"

export function Language() {
  const layoutText = createPoll("⌨️", 1000, () => {
    try {
      const output = exec("hyprctl devices -j")
      const devices = JSON.parse(output)

      const keyboard = devices.keyboards?.find((k: { main?: boolean }) => k.main) || devices.keyboards?.[0]

      if (keyboard) {
        const layouts = keyboard.layout.split(",")
        const activeIndex = keyboard.active_layout_index
        const activeLayout = layouts[activeIndex]

        if (activeLayout === "us") return "🇺🇸"
        if (activeLayout === "ua" || activeLayout === "uk") return "🇺🇦"

        return activeLayout.toUpperCase()
      }
    } catch {
      // keep fallback
    }
    return "⌨️"
  })

  return (
    <button class="language" tooltipText="Keyboard layout">
      <label label={layoutText} />
    </button>
  )
}
