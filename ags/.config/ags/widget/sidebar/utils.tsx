import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

// ---------------------------------------------------------------------------
// Persisted collapse state
// ---------------------------------------------------------------------------

const STATE_FILE = `${GLib.get_user_state_dir()}/ags-sidebar-sections.json`
let cache: Record<string, boolean> | null = null

function loadCache(): Record<string, boolean> {
  if (cache) return cache
  cache = {}
  try {
    const [ok, bytes] = GLib.file_get_contents(STATE_FILE)
    if (ok) cache = (JSON.parse(new TextDecoder().decode(bytes)) as Record<string, boolean>) || {}
  } catch {
    cache = {}
  }
  return cache
}

function persist(id: string, open: boolean) {
  const c = loadCache()
  c[id] = open
  try {
    GLib.file_set_contents(STATE_FILE, JSON.stringify(c))
  } catch {
    /* best effort */
  }
}

/**
 * Creates a Gtk.Revealer + toggle button + summary label trio.
 *
 * Usage:
 *   const { revealer, toggleBtn, summaryLabel } = sectionRevealer(false, "system")
 *   revealer.set_child(myContent)
 *   state.subscribe(s => { summaryLabel.label = `CPU ${s.cpu}%` })
 *
 * summaryLabel is visible only when collapsed. Place it between the section
 * title and toggleBtn in the header row. When `id` is given, the open/closed
 * state is remembered across sidebar opens (and restarts).
 */
export function sectionRevealer(startOpen = false, id?: string) {
  const c = id ? loadCache() : null
  let open = id && c && id in c ? c[id] : startOpen

  const revealer = new Gtk.Revealer({
    reveal_child: open,
    transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transition_duration: 200,
  })

  const summaryLabel = new Gtk.Label({ label: "", visible: !open })
  summaryLabel.add_css_class("sidebar-section-summary")

  // Must be `let` so the onClicked closure can safely capture it after assignment
  let toggleBtn: Gtk.Button
  toggleBtn = (
    <button
      class="sidebar-section-toggle"
      onClicked={() => {
        open = !open
        revealer.set_reveal_child(open)
        summaryLabel.visible = !open
        const icon = toggleBtn.get_child() as Gtk.Label
        if (icon) icon.label = open ? "󰅃" : "󰅀"
        if (id) persist(id, open)
      }}
    >
      <label label={open ? "󰅃" : "󰅀"} />
    </button>
  ) as Gtk.Button

  return { revealer, toggleBtn, summaryLabel }
}
