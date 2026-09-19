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
