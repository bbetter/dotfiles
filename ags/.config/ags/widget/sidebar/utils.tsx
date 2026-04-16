import { Gtk } from "ags/gtk4"

/**
 * Creates a Gtk.Revealer + toggle button + summary label trio.
 *
 * Usage:
 *   const { revealer, toggleBtn, summaryLabel } = sectionRevealer(false)
 *   revealer.set_child(myContent)
 *   state.subscribe(s => { summaryLabel.label = `CPU ${s.cpu}%` })
 *
 * summaryLabel is visible only when collapsed. Place it between the section
 * title and toggleBtn in the header row.
 */
export function sectionRevealer(startOpen = false) {
  const revealer = new Gtk.Revealer({
    reveal_child: startOpen,
    transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transition_duration: 200,
  })

  const summaryLabel = new Gtk.Label({ label: "", visible: !startOpen })
  summaryLabel.add_css_class("sidebar-section-summary")

  let open = startOpen
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
      }}
    >
      <label label={startOpen ? "󰅃" : "󰅀"} />
    </button>
  ) as Gtk.Button

  return { revealer, toggleBtn, summaryLabel }
}
