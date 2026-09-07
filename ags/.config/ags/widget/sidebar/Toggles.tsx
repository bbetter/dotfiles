import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"

// idle.sh's swayidle skips the lock / screen-blank timeouts while this file
// exists. Lives in the runtime dir so it clears on logout.
const GUARD = `${GLib.get_user_runtime_dir()}/ags-keep-awake`

function guardExists(): boolean {
  return GLib.file_test(GUARD, GLib.FileTest.EXISTS)
}

export function SidebarToggles() {
  let on = guardExists()

  const icon = new Gtk.Label({ label: on ? "󰅶" : "󰾪" })
  const btn = (
    <button
      class={`sidebar-toggle-pill${on ? " active" : ""}`}
      tooltipText="Keep awake — pause the idle lock and screen-blank"
    >
      <box spacing={8}>
        {icon}
        <label label="Keep awake" />
      </box>
    </button>
  ) as Gtk.Button

  btn.connect("clicked", () => {
    on = !on
    try {
      if (on) GLib.file_set_contents(GUARD, "")
      else Gio.File.new_for_path(GUARD).delete(null)
    } catch {
      /* best effort */
    }
    icon.label = on ? "󰅶" : "󰾪"
    if (on) btn.add_css_class("active")
    else btn.remove_css_class("active")
  })

  return (
    <box spacing={8} class="sidebar-toggle-row">
      {btn}
    </box>
  )
}
