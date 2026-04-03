import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

interface ActivityState {
  printer: string
  recording: string
  claudeSummary: string
  claudeDetail: string
  claudeTone: string
  claudeVisible: boolean
  codexSummary: string
  codexDetail: string
  codexTone: string
  codexVisible: boolean
  aiushVisible: boolean
  visible: boolean
}

interface ProviderView {
  summary: string
  detail: string
  tone: string
  visible: boolean
}

function emptyProvider(): ProviderView {
  return { summary: "", detail: "", tone: "active", visible: false }
}

function percentageTone(values: Array<number | null>): string {
  const filtered = values.filter((value): value is number => value !== null)
  if (filtered.length === 0) return "active"
  const remaining = Math.min(...filtered)
  if (remaining < 10) return "critical"
  if (remaining < 30) return "warning"
  return "active"
}

function extractPercent(line: string): number | null {
  const match = line.match(/(\d+)%/)
  return match ? Number(match[1]) : null
}

function parseClaude(lines: string[]): ProviderView {
  const sessionLine = lines.find(line => line.startsWith("5h window:")) ?? lines[0] ?? ""
  const weekLine = lines.find(line => line.startsWith("7 days:")) ?? lines[1] ?? ""
  const sessionPct = extractPercent(sessionLine)
  const weekPct = extractPercent(weekLine)

  const summary = sessionPct !== null
    ? `${sessionPct}% left in 5h window`
    : (sessionLine || "No recent data")

  const detailParts = [
    sessionLine.replace(/^5h window:\s*/, "").trim(),
    weekLine.replace(/^7 days:\s*/, "7d ").trim(),
  ].filter(Boolean)

  return {
    summary,
    detail: detailParts.join("\n"),
    tone: percentageTone([sessionPct, weekPct]),
    visible: true,
  }
}

function parseCodex(lines: string[]): ProviderView {
  const windowLine = lines.find(line => line.startsWith("Window:")) ?? ""
  const usedLine = lines.find(line => line.startsWith("Used:")) ?? ""
  const remainingLine = lines.find(line => line.startsWith("Remaining:")) ?? lines[0] ?? ""
  const threadsLine = lines.find(line => line.startsWith("Threads:")) ?? ""
  const remainingPct = extractPercent(remainingLine)
  const windowLabel = windowLine.replace(/^Window:\s*/, "").trim()

  const summary = remainingPct !== null
    ? `${remainingPct}% left${windowLabel ? ` in ${windowLabel}` : ""}`
    : (remainingLine.replace(/^Remaining:\s*/, "").trim() || "No recent data")

  const detailParts = [
    usedLine.replace(/^Used:\s*/, "").trim(),
    threadsLine ? `${threadsLine.replace(/^Threads:\s*/, "").trim()} active threads` : "",
  ].filter(Boolean)

  return {
    summary,
    detail: detailParts.join("\n"),
    tone: percentageTone([remainingPct]),
    visible: true,
  }
}

function parseAiushTooltip(tooltip: string): { claude: ProviderView; codex: ProviderView } {
  const providers = {
    claude: emptyProvider(),
    codex: emptyProvider(),
  }

  const matches = tooltip.matchAll(/<b>(.*?)<\/b>\n\n([\s\S]*?)(?=\n\n<b>|$)/g)
  for (const match of matches) {
    const title = match[1]?.trim() ?? ""
    const body = match[2]?.trim() ?? ""
    const lines = body.split("\n").map(line => line.trim()).filter(Boolean)
    if (!lines.length) continue

    if (title === "Claude Code") {
      providers.claude = parseClaude(lines)
    } else if (title === "Codex CLI") {
      providers.codex = parseCodex(lines)
    }
  }

  return providers
}

export function SidebarActivity() {
  const scriptsPath = `${GLib.get_home_dir()}/.config/ags/scripts`

  const state = createPoll<ActivityState>(
    {
      printer: "Idle",
      recording: "Not recording",
      claudeSummary: "",
      claudeDetail: "",
      claudeTone: "active",
      claudeVisible: false,
      codexSummary: "",
      codexDetail: "",
      codexTone: "active",
      codexVisible: false,
      aiushVisible: false,
      visible: true,
    },
    1000,
    async () => {
      let printer = "Idle"
      try {
        const output = (await execAsync("lpstat -l -o")).trim()
        if (output) {
          const count = output.split("\n").filter(line => /^\S/.test(line)).length
          printer = count > 0 ? `${count} print job${count > 1 ? "s" : ""}` : "Idle"
        }
      } catch {
        // keep fallback
      }

      let recording = "Not recording"
      try {
        const output = (await execAsync(`${scriptsPath}/recording-status.sh`)).trim()
        if (output) {
          const data = JSON.parse(output) as { text?: string }
          if (data.text) recording = data.text
        }
      } catch {
        // keep fallback
      }

      let claudeSummary = ""
      let claudeDetail = ""
      let claudeTone = "active"
      let claudeVisible = false
      let codexSummary = ""
      let codexDetail = ""
      let codexTone = "active"
      let codexVisible = false
      let aiushVisible = false
      try {
        const raw = (await execAsync(`python3 ${GLib.get_home_dir()}/.local/lib/aiush/aiush.py --once`)).trim()
        if (raw) {
          const data = JSON.parse(raw) as { tooltip?: string }
          const parsed = parseAiushTooltip(data.tooltip ?? "")
          claudeSummary = parsed.claude.summary
          claudeDetail = parsed.claude.detail
          claudeTone = parsed.claude.tone
          claudeVisible = parsed.claude.visible
          codexSummary = parsed.codex.summary
          codexDetail = parsed.codex.detail
          codexTone = parsed.codex.tone
          codexVisible = parsed.codex.visible
          aiushVisible = claudeVisible || codexVisible
        }
      } catch {
        // keep fallback
      }

      return {
        printer,
        recording,
        claudeSummary,
        claudeDetail,
        claudeTone,
        claudeVisible,
        codexSummary,
        codexDetail,
        codexTone,
        codexVisible,
        aiushVisible,
        visible: true,
      }
    },
  )

  return (
    <box orientation={1} spacing={6} class="sidebar-section" visible={state.as(s => s.visible)}>
      <label label="ACTIVITY" class="sidebar-section-title" halign={Gtk.Align.START} />
      <box spacing={8} homogeneous class="sidebar-utility-grid">
        <box orientation={1} spacing={2} class="sidebar-mini-card">
          <label label="PRINT" class="sidebar-row-label" halign={Gtk.Align.START} />
          <label label={state.as(s => s.printer)} class="sidebar-summary-title" halign={Gtk.Align.START} wrap />
        </box>
        <box orientation={1} spacing={2} class="sidebar-mini-card">
          <label label="RECORD" class="sidebar-row-label" halign={Gtk.Align.START} />
          <label label={state.as(s => s.recording)} class="sidebar-summary-title" halign={Gtk.Align.START} wrap />
        </box>
      </box>
      <box
        orientation={1}
        spacing={8}
        class="sidebar-card sidebar-compact-card sidebar-ai-usage-card"
        visible={state.as(s => s.aiushVisible)}
      >
        <box orientation={1} spacing={2} class="sidebar-ai-usage-header">
          <label label="AI Usage" class="sidebar-summary-title" halign={Gtk.Align.START} />
          <label
            label="Local session snapshot from aiush"
            class="sidebar-muted sidebar-ai-usage-caption"
            halign={Gtk.Align.START}
          />
        </box>
        <box spacing={8} homogeneous class="sidebar-ai-usage-grid">
          <box
            orientation={1}
            spacing={4}
            visible={state.as(s => s.claudeVisible)}
            class={state.as(s => `sidebar-mini-card sidebar-ai-provider sidebar-ai-provider-${s.claudeTone}`)}
          >
            <label label="Claude Code" class="sidebar-row-label" halign={Gtk.Align.START} />
            <label
              label={state.as(s => s.claudeSummary)}
              class="sidebar-summary-title sidebar-ai-provider-summary"
              halign={Gtk.Align.START}
              wrap
            />
            <label
              label={state.as(s => s.claudeDetail)}
              class="sidebar-muted sidebar-ai-provider-detail"
              halign={Gtk.Align.START}
              wrap
            />
          </box>
          <box
            orientation={1}
            spacing={4}
            visible={state.as(s => s.codexVisible)}
            class={state.as(s => `sidebar-mini-card sidebar-ai-provider sidebar-ai-provider-${s.codexTone}`)}
          >
            <label label="Codex CLI" class="sidebar-row-label" halign={Gtk.Align.START} />
            <label
              label={state.as(s => s.codexSummary)}
              class="sidebar-summary-title sidebar-ai-provider-summary"
              halign={Gtk.Align.START}
              wrap
            />
            <label
              label={state.as(s => s.codexDetail)}
              class="sidebar-muted sidebar-ai-provider-detail"
              halign={Gtk.Align.START}
              wrap
            />
          </box>
        </box>
      </box>
    </box>
  )
}
