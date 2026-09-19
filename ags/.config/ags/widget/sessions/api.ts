// Thin wrappers around the `hypr-sm` CLI and `hyprctl`. The GUI never parses
// session files or decides what is safe to close: hypr-sm owns that.
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { execAsync } from "ags/process"

/** Must equal GUI_TITLE in hypr-sm (it never saves or closes this window). */
export const WINDOW_TITLE = "hypr-sm sessions"

const HYPR_SM = `${GLib.get_home_dir()}/.local/bin/hypr-sm`

export interface SmWindow {
  class: string
  cmd: string
  monitor: string
  workspace: number | null
  floating: boolean
  cwd?: string | null
  tabs?: number
}

/** persistent = named by the user, kept until deleted; the rest are automatic ("recent"). */
export type SessionKind = "persistent" | "autosave" | "previous" | "before" | "recent" | "broken"

export interface SmSession {
  stem: string
  name: string
  kind: SessionKind
  persistent: boolean
  open: boolean
  path: string
  windows: SmWindow[]
  error?: string
}

export interface ClosingInfo {
  count: number
  head: string
  warnings: string[]
}

const sm = (...args: string[]) => execAsync([HYPR_SM, ...args])

export async function listSessions(): Promise<SmSession[]> {
  return JSON.parse(await sm("list", "--json")).sessions
}

export async function closingInfo(): Promise<ClosingInfo> {
  return JSON.parse(await sm("closing", "--json"))
}

export type OpenMode = "replace" | "alongside" | "switch"

export function openSession(stem: string, mode: OpenMode, opts: { newCopy?: boolean } = {}) {
  // --yes: the GUI already asked (and showed what closes) before calling this.
  return sm("open", stem, "--mode", mode, "--yes", ...(opts.newCopy ? ["--new"] : []))
}

/** Save the open windows (or just `addrs`) as a new persistent session. */
export function saveSession(name: string, addrs: string[] | null) {
  return sm("save", name, ...(addrs ? ["--windows", addrs.join(",")] : []))
}

/** Give a recent session a name: it becomes persistent. Resolves with its new id (stem). */
export async function persistSession(stem: string, name: string): Promise<string> {
  return JSON.parse(await sm("persist", stem, name)).stem
}

export const renameSession = (stem: string, name: string) => sm("rename", stem, name)

/** Copy any session to a new persistent one; the original stays. Resolves with the new id. */
export async function duplicateSession(stem: string, name: string): Promise<string> {
  return JSON.parse(await sm("duplicate", stem, name)).stem
}

export const deleteSession = (stem: string) => sm("delete", stem)

const dispatch = (expr: string) => execAsync(["hyprctl", "-q", "dispatch", expr])

/** AstalHyprland may hand out addresses without the 0x prefix; Hyprland needs it. */
const withPrefix = (a: string) => (a.startsWith("0x") ? a : `0x${a}`)

export function moveWindow(address: string, workspace: number) {
  return dispatch(
    `hl.dsp.window.move({ workspace = ${workspace}, follow = false, window = "address:${withPrefix(address)}" })`,
  )
}

export function focusWindow(address: string) {
  return dispatch(`hl.dsp.focus({ window = "address:${withPrefix(address)}" })`)
}

/** {monitor name: numbered workspaces the config binds to it}. */
export async function workspaceRanges(): Promise<Record<string, number[]>> {
  const out: Record<string, number[]> = {}
  try {
    const rules = JSON.parse(await execAsync(["hyprctl", "-j", "workspacerules"]))
    for (const r of rules) {
      const id = Number(r.workspaceString)
      if (Number.isInteger(id) && id > 0 && r.monitor) (out[r.monitor] ??= []).push(id)
    }
    for (const k of Object.keys(out)) out[k].sort((a, b) => a - b)
  } catch {
    /* no rules: the pane falls back to whatever workspaces exist */
  }
  return out
}

// ── session editor ────────────────────────────────────────────────────────

export interface EditWindow {
  cmd: string
  monitor: "primary" | "secondary"
  workspace?: number
  cwd?: string
  class?: string
  timeout?: number
  floating?: boolean
  tabs?: string[]
  geometry?: { x: number; y: number; w: number; h: number; sw?: number; sh?: number }
  [extra: string]: unknown // keys the form doesn't know are kept as they are
}

export interface EditData {
  name: string
  view?: { primary?: number; secondary?: number }
  window: EditWindow[]
}

export interface OpenWindow {
  address: string
  class: string
  title: string
  window: EditWindow
}

/** Like execAsync, but feeds `input` to stdin (execAsync can't). */
function runWithInput(argv: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = Gio.Subprocess.new(
      argv,
      Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    )
    proc.communicate_utf8_async(input, null, (_p, res) => {
      try {
        const [, out, err] = proc.communicate_utf8_finish(res)
        if (proc.get_successful()) resolve(out ?? "")
        else reject((err || out || "hypr-sm failed").trim())
      } catch (e) {
        reject(String(e))
      }
    })
  })
}

export async function showSession(stem: string): Promise<{ stem: string; kind: SessionKind; data: EditData }> {
  return JSON.parse(await sm("show", stem, "--json"))
}

/** Create (stem omitted) or overwrite a persistent session. Rejects with hypr-sm's validation message. */
export async function writeSession(
  data: EditData,
  stem?: string,
): Promise<{ stem: string; path: string; warnings: string[] }> {
  const out = await runWithInput([HYPR_SM, "write", ...(stem ? ["--stem", stem] : [])], JSON.stringify(data))
  return JSON.parse(out)
}

export async function openWindows(): Promise<OpenWindow[]> {
  return JSON.parse(await sm("windows", "--json")).windows
}

// ── progress, undo, plan ─────────────────────────────────────────────────────

export interface OpenEvent {
  event: "start" | "launching" | "placed" | "failed" | "done"
  i?: number
  n?: number
  window?: string
  reason?: string
  session?: string
}

export interface OpenResult {
  opened: number
  n: number
  failed: { window: string; reason: string }[]
}

/** Run a command and hand each stdout line (stderr merged in) to onLine as it arrives. */
function runStreaming(argv: string[], onLine: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE)
    const stream = new Gio.DataInputStream({ baseStream: proc.get_stdout_pipe()! })
    const tail: string[] = []
    const next = () =>
      stream.read_line_async(GLib.PRIORITY_DEFAULT, null, (_s, res) => {
        try {
          const [line] = stream.read_line_finish_utf8(res)
          if (line === null) {
            proc.wait_async(null, (_p, r) => {
              try {
                proc.wait_finish(r)
              } catch {
                /* exit status is read below */
              }
              if (proc.get_successful()) resolve()
              else reject(tail.filter(l => !l.startsWith("@progress")).pop() ?? "hypr-sm failed")
            })
            return
          }
          onLine(line)
          tail.push(line)
          if (tail.length > 20) tail.shift()
          next()
        } catch (e) {
          reject(String(e))
        }
      })
    next()
  })
}

function collect(onEvent?: (e: OpenEvent) => void) {
  let result: OpenResult = { opened: 0, n: 0, failed: [] }
  return {
    onLine: (line: string) => {
      if (!line.startsWith("@progress ")) return
      try {
        const ev = JSON.parse(line.slice(10))
        if (ev.event === "done") result = { opened: ev.opened, n: ev.n, failed: ev.failed ?? [] }
        onEvent?.(ev)
      } catch {
        /* a torn line is not worth failing over */
      }
    },
    result: () => result,
  }
}

/** Open a session, reporting each window as it launches. Resolves with the summary. */
export async function openSessionStream(
  stem: string,
  mode: OpenMode,
  opts: { newCopy?: boolean } = {},
  onEvent?: (e: OpenEvent) => void,
): Promise<OpenResult> {
  const c = collect(onEvent)
  await runStreaming(
    [HYPR_SM, "open", stem, "--mode", mode, "--yes", "--progress", ...(opts.newCopy ? ["--new"] : [])],
    c.onLine,
  )
  return c.result()
}

export interface UndoInfo {
  available: boolean
  name: string | null
  age: number | null
  closed: number | null
  stem: string | null
}

export async function undoInfo(): Promise<UndoInfo> {
  return JSON.parse(await sm("undo-info"))
}

/** Put back what the last Replace closed. */
export async function undoLast(onEvent?: (e: OpenEvent) => void): Promise<OpenResult> {
  const c = collect(onEvent)
  await runStreaming([HYPR_SM, "undo", "--progress"], c.onLine)
  return c.result()
}

export interface Plan {
  session: string
  mode: OpenMode
  already_open: boolean
  closing: { class: string; workspace: number }[]
  closing_head: string
  launching: { class: string; workspace: number; monitor: string; floating: boolean; tabs: number; cwd: string | null }[]
  warnings: string[]
}

/** What opening would do right now; changes nothing. */
export async function planSession(stem: string, mode: OpenMode): Promise<Plan> {
  return JSON.parse(await sm("plan", stem, "--mode", mode, "--json"))
}
