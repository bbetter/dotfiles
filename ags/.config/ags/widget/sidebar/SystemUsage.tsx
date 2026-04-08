import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"

interface UsageState {
  cpu: number
  ram: number
  vram: number
}

async function getUsage(): Promise<UsageState> {
  let cpu = 0
  let ram = 0
  let vram = 0

  try {
    // CPU: using top in batch mode (1 iteration)
    const cpuRaw = await execAsync("top -bn1")
    const cpuMatch = cpuRaw.match(/%Cpu\(s\):\s+([\d.]+)\s+us/)
    if (cpuMatch) cpu = parseFloat(cpuMatch[1])

    // RAM: using free
    const memRaw = await execAsync("free -m")
    const lines = memRaw.split("\n")
    const memLine = lines.find(l => l.startsWith("Mem:"))
    if (memLine) {
      const parts = memLine.split(/\s+/).filter(Boolean)
      const total = parseInt(parts[1])
      const used = parseInt(parts[2])
      ram = (used / total) * 100
    }

    // VRAM: nvidia-smi if available
    try {
      const vramRaw = await execAsync("nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits")
      const [used, total] = vramRaw.split(",").map(s => parseInt(s.trim()))
      vram = (used / total) * 100
    } catch {
      vram = 0 // Likely no NVIDIA GPU
    }
  } catch (e) {
    console.error("Failed to get system usage:", e)
  }

  return { cpu, ram, vram }
}

function UsageBar(label: string, value: number, icon: string) {
  const progress = new Gtk.LevelBar({
    min_value: 0,
    max_value: 100,
    value: value,
    hexpand: true,
  })
  progress.add_css_class("usage-bar")

  return (
    <box orientation={1} spacing={2} class="usage-item">
      <box spacing={8}>
        <label label={icon} class="usage-icon" />
        <label label={label} class="sidebar-row-label" hexpand halign={Gtk.Align.START} />
        <label label={`${Math.round(value)}%`} class="sidebar-row-value" />
      </box>
      {progress}
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
        {state.as(s => UsageBar("CPU", s.cpu, "󰻠"))}
        {state.as(s => UsageBar("RAM", s.ram, "󰍛"))}
        {state.as(s => s.vram > 0 ? UsageBar("VRAM", s.vram, "󰢮") : <box />)}
      </box>
    </box>
  )
}
