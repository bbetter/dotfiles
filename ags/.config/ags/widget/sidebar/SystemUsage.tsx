import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"

interface UsageState {
  cpu: number
  ram: number
  vram: number
}

let prevCpu = { total: 0, idle: 0 }

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

  return { 
    cpu: Number.isFinite(cpu) ? cpu : 0, 
    ram: Number.isFinite(ram) ? ram : 0, 
    vram: Number.isFinite(vram) ? vram : 0 
  }
}

function GradientProgressBar(valueBinding: any) {
  return (
    <box 
      class="usage-gradient-bar" 
      hexpand
      css={valueBinding.as((v: number) => {
        const p = Math.max(0, Math.min(100, Math.round(v || 0)))
        return `background: linear-gradient(to right, var(--primary-color) ${p}%, rgba(255, 255, 255, 0.08) ${p}%);`
      })}
    />
  )
}

function UsageItem(label: string, valueBinding: any, icon: string) {
  return (
    <box orientation={1} spacing={2} class="usage-item">
      <box spacing={8}>
        <label label={icon} class="usage-icon" />
        <label label={label} class="sidebar-row-label" hexpand halign={Gtk.Align.START} />
        <label label={valueBinding.as((v: number) => `${Math.round(v || 0)}%`)} class="sidebar-row-value" />
      </box>
      {GradientProgressBar(valueBinding)}
    </box>
  )
}

export function SystemUsage() {
  const state = createPoll<UsageState>(
    { cpu: 0, ram: 0, vram: 0 },
    2000,
    getUsage
  )

  return (
    <box orientation={1} spacing={8} class="sidebar-section">
      <label label="SYSTEM" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box orientation={1} spacing={10} class="sidebar-mini-card">
        {UsageItem("CPU", state.as(s => s.cpu), "󰻠")}
        {UsageItem("RAM", state.as(s => s.ram), "󰍛")}
        <box 
          orientation={1} 
          spacing={10}
          visible={state.as(s => (s.vram || 0) > 0)}
        >
          {UsageItem("VRAM", state.as(s => s.vram), "󰢮")}
        </box>
      </box>
    </box>
  )
}
