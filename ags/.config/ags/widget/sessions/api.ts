// Thin wrappers around the `hypr-sm` CLI and `hyprctl`. The GUI never parses
// templates or decides what is safe to close: hypr-sm owns that.
import GLib from "gi://GLib"
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

export type SessionKind = "template" | "saved" | "autosave" | "previous" | "before" | "broken"

export interface SmSession {
  stem: string
  name: string
  kind: SessionKind
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

export function saveSession(name: string, addrs: string[] | null, asTemplate: boolean) {
  return sm(
    "save",
    name,
    ...(addrs ? ["--windows", addrs.join(",")] : []),
    ...(asTemplate ? ["--template"] : []),
  )
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
