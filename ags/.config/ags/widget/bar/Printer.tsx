import { createPoll } from "ags/time"
import { exec } from "ags/process"

interface PrinterState {
  text: string
  tooltip: string
  visible: boolean
}

function getPrinterState(): PrinterState {
  try {
    const output = exec("lpstat -l -o").trim()
    if (!output) return { text: "", tooltip: "", visible: false }

    // Count jobs by counting lines that start with a job name (non-whitespace at line start)
    const jobLines = output.split("\n").filter(l => /^\S/.test(l))
    const count = jobLines.length
    if (count === 0) return { text: "", tooltip: "", visible: false }

    const statusLine = output.split("\n").find(l => l.includes("Status:"))
    const tooltip = statusLine
      ? statusLine.replace(/.*Status:\s*/, "").trim()
      : jobLines[0]?.split(/\s+/)[0] ?? ""

    return {
      text: `🖨 ${count} job${count > 1 ? "s" : ""}`,
      tooltip,
      visible: true,
    }
  } catch {
    return { text: "", tooltip: "", visible: false }
  }
}

export function PrinterStatus() {
  const state = createPoll<PrinterState>(
    { text: "", tooltip: "", visible: false },
    3000,
    getPrinterState
  )

  return (
    <button
      class="printer"
      visible={state.as(s => s.visible)}
      tooltipText={state.as(s => s.tooltip)}
    >
      <label label={state.as(s => s.text)} />
    </button>
  )
}
