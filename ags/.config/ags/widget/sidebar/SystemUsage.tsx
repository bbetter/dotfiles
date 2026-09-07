import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { sectionRevealer } from "./utils"
import { isSidebarOpen } from "./state"

interface UsageState {
  cpu: number
  ram: number
  vram: number
}

let prevCpu = { total: 0, idle: 0 }
const HISTORY_SIZE = 30
const history = {
  cpu: new Array(HISTORY_SIZE).fill(0),
  ram: new Array(HISTORY_SIZE).fill(0),
  vram: new Array(HISTORY_SIZE).fill(0),
}

function readFile(path: string): string | null {
  try {
    const [ok, bytes] = GLib.file_get_contents(path)
    return ok ? new TextDecoder().decode(bytes) : null
  } catch {
    return null
  }
}

// amdgpu VRAM sysfs paths — resolved once (the dGPU with the most VRAM, not the
// small integrated GPU). The `for` loop over /sys/class/drm runs a single time.
let vramFiles: { used: string; total: string } | null | undefined
async function resolveVramFiles() {
  if (vramFiles !== undefined) return vramFiles
  vramFiles = null
  try {
    const dir = (
      await execAsync(["bash", "-c",
        'best=""; bt=0; for d in /sys/class/drm/card[0-9]*/device; do ' +
        '[ -r "$d/mem_info_vram_total" ] || continue; ' +
        't=$(cat "$d/mem_info_vram_total"); ' +
        '[ "$t" -gt "$bt" ] && { bt=$t; best=$d; }; done; ' +
        '[ -n "$best" ] && printf %s "$best"',
      ])
    ).trim()
    if (dir) vramFiles = { used: `${dir}/mem_info_vram_used`, total: `${dir}/mem_info_vram_total` }
  } catch {
    /* leave null */
  }
  return vramFiles
}

async function getUsage(): Promise<UsageState> {
  let cpu = 0
  let ram = 0
  let vram = 0

  const stat = readFile("/proc/stat")
  const cpuLine = stat?.split("\n").find(l => l.startsWith("cpu "))
  if (cpuLine) {
    const v = cpuLine.trim().split(/\s+/).slice(1).map(Number)
    const idle = v[3] + (v[4] || 0)
    const total = v.reduce((a, b) => a + b, 0)
    const dtotal = total - prevCpu.total
    const didle = idle - prevCpu.idle
    prevCpu = { total, idle }
    if (dtotal > 0) cpu = (100 * (dtotal - didle)) / dtotal
  }

  const mem = readFile("/proc/meminfo")
  if (mem) {
    const get = (k: string) => {
      const m = mem.match(new RegExp(`^${k}:\\s+(\\d+)`, "m"))
      return m ? Number(m[1]) : 0
    }
    const total = get("MemTotal")
    const avail = get("MemAvailable")
    if (total > 0) ram = ((total - avail) / total) * 100
  }

  const vf = await resolveVramFiles()
  if (vf) {
    const used = Number(readFile(vf.used)?.trim())
    const total = Number(readFile(vf.total)?.trim())
    if (total > 0 && Number.isFinite(used)) vram = (used / total) * 100
  }

  const result = {
    cpu: Number.isFinite(cpu) ? Math.max(0, Math.min(100, cpu)) : 0,
    ram: Number.isFinite(ram) ? ram : 0,
    vram: Number.isFinite(vram) ? vram : 0,
  }

  history.cpu.shift(); history.cpu.push(result.cpu)
  history.ram.shift(); history.ram.push(result.ram)
  history.vram.shift(); history.vram.push(result.vram)

  return result
}

function UsageChart(key: keyof typeof history) {
  const drawingArea = new Gtk.DrawingArea({
    height_request: 36,
    hexpand: true,
  })
  drawingArea.add_css_class("usage-chart")

  drawingArea.set_draw_func((area, cr, width, height) => {
    const data = history[key]
    const step = width / (HISTORY_SIZE - 1)
    // Follows the theme: `.usage-chart { color: ... }` in the stylesheet.
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

function UsageItem(label: string, valueBinding: any, icon: string, historyKey: keyof typeof history) {
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

export function SystemUsage() {
  const state = createPoll<UsageState>(
    { cpu: 0, ram: 0, vram: 0 },
    2000,
    async (prev) => (isSidebarOpen() ? getUsage() : prev),
  )

  const { revealer, toggleBtn, summaryLabel } = sectionRevealer(false, "system")

  state.subscribe(() => {
    const s = state.peek()
    summaryLabel.label = `CPU ${Math.round(s.cpu)}% · RAM ${Math.round(s.ram)}%`
  })

  const listContainer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  listContainer.add_css_class("sidebar-mini-card")
  listContainer.append(UsageItem("CPU", state.as(s => s.cpu), "󰻠", "cpu"))
  listContainer.append(UsageItem("RAM", state.as(s => s.ram), "󰍛", "ram"))

  const vramItem = UsageItem("VRAM", state.as(s => s.vram), "󰢮", "vram")
  const vramBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  vramBox.append(vramItem)
  const vramVisible = state.as(s => s.vram > 0)
  vramVisible.subscribe(() => { vramBox.visible = vramVisible.peek() })
  listContainer.append(vramBox)

  revealer.set_child(listContainer)

  return (
    <box orientation={1} spacing={4} class="sidebar-section">
      <box hexpand spacing={6} class="sidebar-section-header">
        <label
          label="SYSTEM PERFORMANCE"
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
