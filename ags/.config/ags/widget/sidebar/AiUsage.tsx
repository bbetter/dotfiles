import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { sectionRevealer } from "./utils"

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderView {
  label: string
  summary: string
  detail: string
  tone: string   // "active" | "warning" | "critical"
  visible: boolean
}

function emptyProvider(label: string): ProviderView {
  return { label, summary: "", detail: "", tone: "active", visible: false }
}

function extractPercent(line: string): number | null {
  const match = line.match(/(\d+(?:\.\d+)?)%/)
  return match ? Number(match[1]) : null
}

function tone(values: Array<number | null>): string {
  const nums = values.filter((v): v is number => v !== null)
  if (!nums.length) return "active"
  const min = Math.min(...nums)
  if (min < 10) return "critical"
  if (min < 30) return "warning"
  return "active"
}

function parseClaude(lines: string[]): ProviderView {
  const sessionLine = lines.find(l => l.startsWith("5h window:")) ?? lines[0] ?? ""
  const weekLine   = lines.find(l => l.startsWith("7 days:"))    ?? lines[1] ?? ""
  const sessionPct = extractPercent(sessionLine)
  const weekPct    = extractPercent(weekLine)

  const summary = sessionPct !== null
    ? `${sessionPct}% left in 5h window`
    : sessionLine || "No data"

  const detail = [
    sessionLine.replace(/^5h window:\s*/, "").trim(),
    weekLine.replace(/^7 days:\s*/, "7d ").trim(),
  ].filter(Boolean).join("\n")

  return { label: "Claude Code", summary, detail, tone: tone([sessionPct, weekPct]), visible: true }
}

function parseTokenProvider(label: string, lines: string[]): ProviderView {
  const remainingLine = lines.find(l => l.startsWith("Remaining:")) ?? lines[0] ?? ""
  const usedLine      = lines.find(l => l.startsWith("Used:"))      ?? ""
  const windowLine    = lines.find(l => l.startsWith("Window:"))    ?? ""
  const threadsLine   = lines.find(l => l.startsWith("Threads:"))   ?? ""
  const remainingPct  = extractPercent(remainingLine)

  const window = windowLine.replace(/^Window:\s*/, "").trim()
  const summary = remainingPct !== null
    ? `${remainingPct}% left${window ? ` · ${window}` : ""}`
    : remainingLine.replace(/^Remaining:\s*/, "").trim() || "No data"

  const detailParts = [
    usedLine.replace(/^Used:\s*/, "").trim(),
    threadsLine ? `${threadsLine.replace(/^Threads:\s*/, "").trim()} threads` : "",
  ].filter(Boolean)

  return { label, summary, detail: detailParts.join("\n"), tone: tone([remainingPct]), visible: true }
}

interface ParsedProviders {
  claude: ProviderView
  codex:  ProviderView
  qwen:   ProviderView
}

function parseTooltip(tooltip: string): ParsedProviders {
  const result: ParsedProviders = {
    claude: emptyProvider("Claude Code"),
    codex:  emptyProvider("Codex CLI"),
    qwen:   emptyProvider("Qwen Code"),
  }

  // Each section: <b>Title</b>\n\nbody until next <b> or end
  const sections = [...tooltip.matchAll(/<b>(.*?)<\/b>\n\n([\s\S]*?)(?=\n\n<b>|$)/g)]
  for (const m of sections) {
    const title = m[1]?.trim() ?? ""
    const lines = (m[2]?.trim() ?? "").split("\n").map(l => l.trim()).filter(Boolean)
    if (!lines.length) continue
    if (title === "Claude Code") result.claude = parseClaude(lines)
    else if (title === "Codex CLI") result.codex = parseTokenProvider("Codex CLI", lines)
    else if (title === "Qwen Code") result.qwen  = parseTokenProvider("Qwen Code", lines)
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

interface AiState {
  claude: ProviderView
  codex:  ProviderView
  qwen:   ProviderView
  visible: boolean
}

const empty: AiState = {
  claude:  emptyProvider("Claude Code"),
  codex:   emptyProvider("Codex CLI"),
  qwen:    emptyProvider("Qwen Code"),
  visible: false,
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SidebarAiUsage() {
  const state = createPoll<AiState>(empty, 60_000, async () => {
    try {
      const raw = (await execAsync(`python3 ${GLib.get_home_dir()}/.local/lib/aiush/aiush.py --once`)).trim()
      if (!raw) return empty
      const data = JSON.parse(raw) as { tooltip?: string }
      const providers = parseTooltip(data.tooltip ?? "")
      const visible = providers.claude.visible || providers.codex.visible || providers.qwen.visible
      return { ...providers, visible }
    } catch {
      return empty
    }
  })

  function card(key: "claude" | "codex" | "qwen") {
    return (
      <box
        orientation={1}
        spacing={4}
        visible={state.as(s => s[key].visible)}
        class={state.as(s => `sidebar-mini-card sidebar-ai-provider sidebar-ai-provider-${s[key].tone}`)}
      >
        <label label={state.as(s => s[key].label)} class="sidebar-row-label" halign={Gtk.Align.START} />
        <label
          label={state.as(s => s[key].summary)}
          class="sidebar-summary-title sidebar-ai-provider-summary"
          halign={Gtk.Align.START}
          wrap
        />
        <label
          label={state.as(s => s[key].detail)}
          class="sidebar-muted sidebar-ai-provider-detail"
          halign={Gtk.Align.START}
          wrap
        />
      </box>
    )
  }

  const { revealer, toggleBtn, summaryLabel } = sectionRevealer(false)

  state.subscribe(() => {
    const s = state.peek()
    if (s.claude.visible) summaryLabel.label = s.claude.summary
    else if (s.codex.visible) summaryLabel.label = s.codex.summary
    else summaryLabel.label = ""
  })

  const content = (
    <box spacing={6} homogeneous class="sidebar-ai-usage-grid" marginBottom={6}>
      {card("claude")}
      {card("codex")}
      {card("qwen")}
    </box>
  ) as Gtk.Box

  revealer.set_child(content)

  return (
    <box
      orientation={1}
      spacing={4}
      class="sidebar-section"
      visible={state.as(s => s.visible)}
    >
      <box hexpand spacing={6} class="sidebar-section-header">
        <label
          label="AI USAGE"
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
