import { createConnection } from "gnim"
import { exec, execAsync } from "ags/process"
import Hyprland from "gi://AstalHyprland"

const KBD = "󰌌" // nf-md-keyboard

function codeFor(layout: string): string {
  if (layout === "us") return "EN"
  if (layout === "ua" || layout === "uk") return "UA"
  return layout.toUpperCase()
}

function readLayout(): string {
  try {
    const devices = JSON.parse(exec("hyprctl devices -j"))
    const keyboard =
      devices.keyboards?.find((k: { main?: boolean }) => k.main) || devices.keyboards?.[0]
    if (keyboard) {
      const active = keyboard.layout.split(",")[keyboard.active_layout_index]
      return `${KBD} ${codeFor(String(active))}`
    }
  } catch {
    // keep fallback
  }
  return KBD
}

export function Language() {
  const hypr = Hyprland.get_default()

  // Re-read only when Hyprland reports a layout switch (a few times a day),
  // instead of spawning `hyprctl devices -j` five times a second.
  const layoutText = createConnection(readLayout(), [
    hypr,
    "keyboard-layout",
    () => readLayout(),
  ])

  return (
    <button
      class="language"
      tooltipText="Click to switch keyboard layout"
      onClicked={() => execAsync(["hyprctl", "switchxkblayout", "current", "next"]).catch(() => {})}
    >
      <label label={layoutText} />
    </button>
  )
}
