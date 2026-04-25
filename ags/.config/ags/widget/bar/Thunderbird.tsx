import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

export function ThunderbirdUnread() {
  const homeDir = GLib.get_home_dir()

  const count = createPoll<number>(0, 30_000, async (prev) => {
    try {
      const result = await execAsync([
        "python3", `${homeDir}/.config/ags/scripts/thunderbird-unread.py`
      ])
      return parseInt(result.trim()) || 0
    } catch {
      return prev
    }
  })

  return (
    <button
      class="thunderbird"
      visible={count.as(n => n > 0)}
      tooltipText={count.as(n => `${n} unread message${n === 1 ? "" : "s"}`)}
      onClicked={() => execAsync(["thunderbird"])}
    >
      <box spacing={5} valign={Gtk.Align.CENTER}>
        <image iconName="thunderbird-symbolic" pixelSize={14} />
        <label label={count.as(n => `${n}`)} />
      </box>
    </button>
  )
}
