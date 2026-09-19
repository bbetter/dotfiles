import app from "ags/gtk4/app"
import { Gtk, Gdk } from "ags/gtk4"
import style from "./style.scss"
import { toggleSessions } from "./widget/Sessions"

// TEMPORARY test driver: find real widgets and emit their real signals.
const sessionsWin = () =>
  app.get_windows().find(w => (w as Gtk.Window).title === "hypr-sm sessions") as Gtk.Window
function* walk(w: Gtk.Widget): Generator<Gtk.Widget> {
  yield w
  for (let c = w.get_first_child(); c; c = c.get_next_sibling()) yield* walk(c)
}
const all = () => [...walk(sessionsWin())].filter(w => w.get_mapped())
const labelOf = (w: Gtk.Widget) =>
  w instanceof Gtk.Button || w instanceof Gtk.Label ? ((w as any).label ?? "") : ""
const ctrls = (w: Gtk.Widget): any[] => {
  const out: any[] = []
  const l = w.observe_controllers()
  for (let i = 0; i < l.get_n_items(); i++) out.push(l.get_item(i))
  return out
}
const cardOf = (name: string): Gtk.Widget | undefined =>
  all().find(
    w => w.get_css_classes().includes("sm-session") &&
      [...walk(w)].some(x => x instanceof Gtk.Label && x.get_css_classes().includes("sm-session-name") && (x as Gtk.Label).label === name),
  )

function describe(): string {
  const out: string[] = []
  for (const w of [...walk(sessionsWin())]) {
    if (!w.get_mapped() && !(w instanceof Gtk.TextView)) continue
    const cls = w.get_css_classes().join(".")
    if (w instanceof Gtk.Label && (w as Gtk.Label).label) out.push(`L[${cls}] ${(w as Gtk.Label).label}`)
    else if (w instanceof Gtk.Button && (w as Gtk.Button).label) out.push(`B[${w.get_sensitive() ? "" : "disabled "}${cls}] ${(w as Gtk.Button).label}`)
    else if (w instanceof Gtk.CheckButton) out.push(`C[${(w as Gtk.CheckButton).active ? "x" : " "}${w.get_sensitive() ? "" : " disabled"}] ${(w as Gtk.CheckButton).label ?? ""}`)
    else if (w instanceof Gtk.DropDown) out.push(`D[${(w as Gtk.DropDown).selected}]`)
    else if (w instanceof Gtk.Expander) out.push(`X[${(w as Gtk.Expander).expanded ? "open" : "closed"}] ${(w as Gtk.Expander).label}`)
    else if (w instanceof Gtk.TextView) out.push(`T lines=${(w as Gtk.TextView).get_buffer().text.split("\n").filter(x => x.trim()).length}`)
    else if (w instanceof Gtk.SearchEntry) out.push(`S "${(w as Gtk.SearchEntry).text}"`)
    else if (w instanceof Gtk.Entry) out.push(`E<${(w as Gtk.Entry).placeholderText}> "${(w as Gtk.Entry).text}"`)
  }
  return out.join("\n")
}

app.start({
  instanceName: "hyprsm-test",
  css: style,
  requestHandler(argv, res) {
    try {
      const [cmd, ...rest] = argv
      const arg = rest.join(" ")
      if (cmd === "sessions") { toggleSessions(rest[0] ?? "toggle"); return res("ok") }
      if (cmd === "quit") { res("ok"); setTimeout(() => app.quit(), 50); return }
      if (cmd === "dump") return res(describe())
      if (cmd === "click") {
        const nth = arg.match(/ #(\d+)$/)
        const text = arg.replace(/ #\d+$/, "")
        const bs = all().filter(w => w instanceof Gtk.Button && labelOf(w).includes(text)) as Gtk.Button[]
        const b = bs[nth ? Number(nth[1]) : 0]
        if (!b) return res(`no button '${text}'`)
        if (!b.get_sensitive()) return res(`button '${text}' is disabled`)
        b.emit("clicked")
        return res("clicked " + labelOf(b))
      }
      if (cmd === "key") { // key <Down|Up|Return|Escape|text> on the focused widget's controllers (search entry)
        const e = all().find(w => w instanceof Gtk.SearchEntry) as Gtk.SearchEntry
        const map: Record<string, number> = { Down: Gdk.KEY_Down, Up: Gdk.KEY_Up, Return: Gdk.KEY_Return, Escape: Gdk.KEY_Escape }
        const kv = map[rest[0]]
        for (const c of ctrls(e)) if (c instanceof Gtk.EventControllerKey) { c.emit("key-pressed", kv, 0, 0); return res("key " + rest[0]) }
        return res("no key controller")
      }
      if (cmd === "tick") { // tick <text in the window row's label>  (Open Now pane)
        for (const w of all()) {
          if (w instanceof Gtk.Box && w.get_css_classes().includes("sm-win")) {
            const t = [...walk(w)].find(x => x instanceof Gtk.Label) as Gtk.Label
            if (t?.label.includes(arg)) {
              ;([...walk(w)].find(x => x instanceof Gtk.CheckButton) as Gtk.CheckButton).set_active(true)
              return res("ticked " + t.label)
            }
          }
        }
        return res("no window row " + arg)
      }
      if (cmd === "search") {
        const e = all().find(w => w instanceof Gtk.SearchEntry) as Gtk.SearchEntry
        e.set_text(arg)
        return res("searching")
      }
      if (cmd === "settabs") {
        const [nth, ...t] = rest
        const tv = [...walk(sessionsWin())].filter(w => w instanceof Gtk.TextView)[Number(nth)] as Gtk.TextView
        if (!tv) return res("no textview")
        tv.get_buffer().set_text(t.join(" ").split("|").join("\n"), -1)
        return res("set")
      }
      if (cmd === "cardbtn") {
        const [name, text] = arg.split("|").map(x => x.trim())
        const card = cardOf(name)
        if (!card) return res(`no card '${name}'`)
        const b = [...walk(card)].find(w => w instanceof Gtk.Button && labelOf(w).includes(text)) as Gtk.Button | undefined
        if (!b) return res(`no button '${text}' in card '${name}'`)
        b.emit("clicked")
        return res(`clicked '${text}' in '${name}'`)
      }
      if (cmd === "cardlabels") {
        const card = cardOf(arg)
        return res(card ? [...walk(card)].filter(x => x instanceof Gtk.Label).map(x => (x as Gtk.Label).label).join("\n") : "no card")
      }
      if (cmd === "cardset") {
        const [name, text] = arg.split("|").map(x => x.trim())
        const card = cardOf(name)
        const e = card && ([...walk(card)].find(w => w instanceof Gtk.Entry) as Gtk.Entry | undefined)
        if (!e) return res("no entry in card")
        e.set_text(text)
        return res("set")
      }
      if (cmd === "cardactivate") {
        const card = cardOf(arg)
        const e = card && ([...walk(card)].find(w => w instanceof Gtk.Entry) as Gtk.Entry | undefined)
        if (!e) return res("no entry in card")
        e.emit("activate")
        return res("activated")
      }
      if (cmd === "set") {
        const [ph, nth, ...t] = rest
        const es = all().filter(w => w instanceof Gtk.Entry && !(w instanceof Gtk.SearchEntry) && ((w as Gtk.Entry).placeholderText ?? "").includes(ph)) as Gtk.Entry[]
        const e = es[Number(nth)]
        if (!e) return res(`no entry ${ph}#${nth} (have ${es.length})`)
        e.set_text(t.join(" "))
        return res("set")
      }
      if (cmd === "expand") {
        const card = cardOf(arg)
        if (!card) return res("no session " + arg)
        for (const w of walk(card)) {
          const c = ctrls(w).find(x => x instanceof Gtk.GestureClick)
          if (c) { c.emit("released", 1, 0, 0); return res("expanded") }
        }
        return res("no click target")
      }
      res("unknown " + cmd)
    } catch (e) {
      res("ERR " + e)
    }
  },
  main() { toggleSessions("open") },
})
