import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"

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

async function getUsage(): Promise<UsageState> {
  let cpu = 0
  let ram = 0
  let vram = 0

  try {
    const statRaw = await execAsync(["bash", "-c", "grep '^cpu ' /proc/stat"])
    const vals = statRaw.trim().split(/\s+/).slice(1).map(Number)
    const idle = vals[3] + vals[4]
    const total = vals.reduce((a, b) => a + b, 0)
    const dtotal = total - prevCpu.total
    const didle = idle - prevCpu.idle
    prevCpu = { total, idle }
    cpu = dtotal > 0 ? (100 * (dtotal - didle)) / dtotal : 0

    const memRaw = await execAsync(["bash", "-c", "LANG=C free -m"])
    const lines = memRaw.split("\n")
    const memLine = lines.find(l => l.startsWith("Mem:"))
    if (memLine) {
      const parts = memLine.split(/\s+/).filter(Boolean)
      const total = parseInt(parts[1])
      const used = parseInt(parts[2])
      if (total > 0) ram = (used / total) * 100
    }

    try {
      const vramRaw = await execAsync(["bash", "-c", "nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits"])
      if (vramRaw && vramRaw.includes(",")) {
        const parts = vramRaw.split(",").map(s => parseInt(s.trim()))
        if (parts.length >= 2 && parts[1] > 0) {
          vram = (parts[0] / parts[1]) * 100
        }
      }
    } catch {
      vram = 0
    }
  } catch (e) {
    console.error("Failed to get system usage:", e)
  }

  const result = {
    cpu: Number.isFinite(cpu) ? cpu : 0,
    ram: Number.isFinite(ram) ? ram : 0,
    vram: Number.isFinite(vram) ? vram : 0
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

  drawingArea.set_draw_func((_area, cr, width, height) => {
    const data = history[key]
    const step = width / (HISTORY_SIZE - 1)

    cr.setSourceRGBA(0.75, 0.54, 0.41, 0.8)
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
    cr.setSourceRGBA(0.75, 0.54, 0.41, 0.1)
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
    getUsage
  )

  const listContainer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10 })
  listContainer.add_css_class("sidebar-mini-card")
  listContainer.append(UsageItem("CPU", state.as(s => s.cpu), "󰻠", "cpu"))
  listContainer.append(UsageItem("RAM", state.as(s => s.ram), "󰍛", "ram"))

  const vramItem = UsageItem("VRAM", state.as(s => s.vram), "󰢮", "vram")
  const vramBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  vramBox.append(vramItem)
  state.as(s => s.vram > 0).subscribe((v: boolean) => { vramBox.visible = v })
  listContainer.append(vramBox)

  const revealer = new Gtk.Revealer({
    reveal_child: false,
    transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transition_duration: 250,
  })
  revealer.set_child(listContainer)

  // Keep a ref to the label so we can update it from the JSX button's onClicked
  const toggleLabel = new Gtk.Label({ label: "Show 󰅀" })

  return (
    <box orientation={1} spacing={4} class="sidebar-section">
      <box hexpand spacing={8}>
        <label
          label="SYSTEM PERFORMANCE"
          class="sidebar-section-title"
          hexpand
          halign={Gtk.Align.START}
        />
        <button
          class="sidebar-notif-toggle"
          onClicked={() => {
            const next = !revealer.get_reveal_child()
            revealer.set_reveal_child(next)
            toggleLabel.label = next ? "Hide 󰅃" : "Show 󰅀"
          }}
        >
          {toggleLabel}
        </button>
      </box>
      {revealer}
    </box>
  )
}
