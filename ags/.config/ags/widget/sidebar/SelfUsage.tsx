import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { sectionRevealer } from "./utils"
import { isSidebarOpen } from "./state"

interface ProcUsage {
  hyprCpu: number
  hyprRam: number
  agsCpu: number
  agsRam: number
}

const HISTORY_SIZE = 30
const history = {
  hyprCpu: new Array(HISTORY_SIZE).fill(0),
  agsCpu: new Array(HISTORY_SIZE).fill(0),
}

// clk_tck is effectively always 100 on glibc/Linux -- not worth a getconf shellout.
const CLK_TCK = 100

function readFile(path: string): string | null {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    return ok ? new TextDecoder().decode(bytes) : null
  } catch {
    return null
  }
}

// Hyprland's own PID -- resolved once and cached (same lazy-resolve-once
// pattern as resolveVramFiles() in SystemUsage.tsx). Stable for the whole
// session: if Hyprland restarts, AGS restarts with it, so there's nothing
// to invalidate.
let hyprPid: number | null | undefined
async function resolveHyprPid(): Promise<number | null> {
  if (hyprPid !== undefined) return hyprPid
  hyprPid = null
  try {
    const out = (await execAsync(["pgrep", "-x", "Hyprland"])).trim()
    const pid = Number(out.split("\n")[0])
    if (Number.isFinite(pid) && pid > 0) hyprPid = pid
  } catch {
    /* leave null */
  }
  return hyprPid
}

// utime+stime from /proc/<id>/stat, where <id> is either a numeric PID
// (Hyprland) or the literal "self" (AGS introspecting its own process --
// no GLib.getpid() binding available here, and /proc/self sidesteps the
// need for one entirely). The comm field (2nd field) is "(...)"-wrapped
// and can itself contain spaces/parens, so we split after the *last* ")"
// rather than assuming fixed field positions from the start.
const prevTicks: Record<string, { ticks: number; t: number }> = {}

function cpuPercentFor(id: string): number {
  const stat = readFile(`/proc/${id}/stat`)
  if (!stat) return 0
  const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/)
  const ticks = Number(fields[11]) + Number(fields[12]) // utime, stime
  if (!Number.isFinite(ticks)) return 0

  const now = GLib.get_monotonic_time() / 1e6
  const prev = prevTicks[id]
  prevTicks[id] = { ticks, t: now }
  if (!prev) return 0

  const dt = now - prev.t
  if (dt <= 0) return 0
  const pct = (100 * (ticks - prev.ticks)) / CLK_TCK / dt
  return Math.max(0, Math.min(100, pct))
}

function rssMbFor(id: string): number {
  const status = readFile(`/proc/${id}/status`)
  const m = status?.match(/^VmRSS:\s+(\d+)/m)
  return m ? Number(m[1]) / 1024 : 0
}

async function getUsage(): Promise<ProcUsage> {
  const hp = await resolveHyprPid()
  const hid = hp !== null ? String(hp) : null

  const result = {
    hyprCpu: hid ? cpuPercentFor(hid) : 0,
    hyprRam: hid ? rssMbFor(hid) : 0,
    agsCpu: cpuPercentFor("self"),
    agsRam: rssMbFor("self"),
  }

  history.hyprCpu.shift(); history.hyprCpu.push(result.hyprCpu)
  history.agsCpu.shift(); history.agsCpu.push(result.agsCpu)

  return result
}

function UsageChart(key: keyof typeof history) {
  const drawingArea = new Gtk.DrawingArea({ height_request: 36, hexpand: true })
  drawingArea.add_css_class("usage-chart")

  drawingArea.set_draw_func((area, cr, width, height) => {
    const data = history[key]
    const step = width / (HISTORY_SIZE - 1)
    const c = area.get_color()

    cr.setSourceRGBA(c.red, c.green, c.blue, 0.85)
    cr.setLineWidth(1.5)

    cr.moveTo(0, height)
    for (let i = 0; i < HISTORY_SIZE; i++) {
      const x = i * step
      const y = height - (data[i] / 100) * height
      cr.lineTo(x, y)
    }
    cr.strokePreserve()

    cr.lineTo(width, height)
    cr.lineTo(0, height)
    cr.setSourceRGBA(c.red, c.green, c.blue, 0.12)
    cr.fill()
  })

  return drawingArea
}

function CpuRow(label: string, valueBinding: any, icon: string, historyKey: keyof typeof history) {
  const chart = UsageChart(historyKey)
  valueBinding.subscribe(() => chart.queue_draw())

  return (
    <box orientation={1} spacing={2} class="usage-item">
      <box spacing={8}>
        <label label={icon} class="usage-icon" />
        <label label={label} class="sidebar-row-label" hexpand halign={Gtk.Align.START} />
        <label label={valueBinding.as((v: number) => `${Math.round(v || 0)}%`)} class="sidebar-row-value" />
      </box>
      {chart}
    </box>
  )
}

function fmtMb(v: number): string {
  if (!Number.isFinite(v)) return "0 MB"
  return v >= 1024 ? `${(v / 1024).toFixed(2)} GB` : `${Math.round(v)} MB`
}

function RamRow(label: string, valueBinding: any, icon: string) {
  return (
    <box spacing={8} class="usage-item">
      <label label={icon} class="usage-icon" />
      <label label={label} class="sidebar-row-label" hexpand halign={Gtk.Align.START} />
      <label label={valueBinding.as(fmtMb)} class="sidebar-row-value" />
    </box>
  )
}

export function SelfUsage() {
  const state = createPoll<ProcUsage>(
    { hyprCpu: 0, hyprRam: 0, agsCpu: 0, agsRam: 0 },
    2000,
    async (prev) => (isSidebarOpen() ? getUsage() : prev),
  )

  const { revealer, toggleBtn, summaryLabel } = sectionRevealer(false, "selfusage")

  state.subscribe(() => {
    const s = state.peek()
    summaryLabel.label = `Hypr ${Math.round(s.hyprCpu)}% · AGS ${Math.round(s.agsCpu)}%`
  })

  const listContainer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  listContainer.add_css_class("sidebar-mini-card")
  listContainer.append(CpuRow("Hyprland CPU", state.as(s => s.hyprCpu), "󰻠", "hyprCpu"))
  listContainer.append(RamRow("Hyprland RAM", state.as(s => s.hyprRam), "󰍛"))
  listContainer.append(CpuRow("AGS CPU", state.as(s => s.agsCpu), "󰻠", "agsCpu"))
  listContainer.append(RamRow("AGS RAM", state.as(s => s.agsRam), "󰍛"))

  revealer.set_child(listContainer)

  return (
    <box orientation={1} spacing={4} class="sidebar-section">
      <box hexpand spacing={6} class="sidebar-section-header">
        <label
          label="СКІЛЬКИ ЖЕРЕ МІЙ СЕТАП"
          class="sidebar-section-title"
          hexpand
          halign={Gtk.Align.START}
        />
        {summaryLabel}
        {toggleBtn}
      </box>
      {revealer}
    </box>
  )
}
