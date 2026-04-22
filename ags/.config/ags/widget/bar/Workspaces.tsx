import Hyprland from "gi://AstalHyprland"
import { Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"

export function Workspaces({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const hypr = Hyprland.get_default()
  if (!hypr) return <box class="workspaces" />

  const box = <box spacing={4} class="workspaces" /> as Gtk.Box
  const connector = gdkmonitor.get_connector() ?? ""

  const buttons = new Map<number, Gtk.Button>()
  const iconBoxes = new Map<number, Gtk.Box>()
  
  // Track current drop target for visual feedback
  let currentTarget: Gtk.Widget | null = null
  let internalDragClient: any = null
  let lastActiveAddress: string | null = null
  let lastActivePos = ""
  let lastActiveMoveMs = 0
  let lastExternalDropTarget: number | null = null
  let lastExternalDropMs = 0
  let externalPressAddress: string | null = null
  let externalPressHovered: number | null = null
  let externalPressStartX = 0
  let externalPressStartY = 0
  let externalPressDragged = false
  const debugLogPath = `/tmp/ags-workspaces-${connector || "unknown"}-poll.log`
  let lastDebugLine = ""

  const debugLog = (message: string) => {
    try {
      if (message === lastDebugLine) return
      lastDebugLine = message
      const line = `${new Date().toISOString()} [${connector || "unknown"}] ${message}\n`
      const file = Gio.File.new_for_path(debugLogPath)
      const out = file.query_exists(null)
        ? file.append_to(Gio.FileCreateFlags.NONE, null)
        : file.create(Gio.FileCreateFlags.NONE, null)
      const bytes = new TextEncoder().encode(line)
      out.write_all(bytes, null)
      out.close(null)
    } catch {}
  }

  const normalizeAddress = (address: string | null | undefined) => {
    if (!address) return null
    return address.startsWith("0x") ? address : `0x${address}`
  }

  const dispatchWorkspaceMove = (targetId: number, address: string) => {
    const cmd = `hyprctl dispatch movetoworkspacesilent "${targetId},address:${address}"`
    try {
      GLib.spawn_command_line_async(cmd)
      refreshAfterMove()
    } catch (e) {
      debugLog(`dispatch-error target=${targetId} address=${address} err=${e}`)
    }
  }

  const getIconName = (className: string) => {
    const lower = className.toLowerCase()
    if (lower.includes("firefox")) return "firefox"
    if (lower.includes("code")) return "visual-studio-code"
    if (lower.includes("telegram")) return "telegram"
    if (lower.includes("spotify")) return "spotify"
    if (lower.includes("terminal") || lower.includes("foot") || lower.includes("kitty")) return "terminal"
    return lower
  }

  const createIcon = (client: any) => {
    const img = new Gtk.Image({
      iconName: getIconName(client.class || ""),
      pixelSize: 14,
    })
    img.add_css_class("workspace-icon")

    // Support dragging the icon itself
    const drag = new Gtk.GestureDrag()
    drag.connect("drag-begin", () => {
      internalDragClient = client
      img.add_css_class("dragging")
    })
    drag.connect("drag-end", () => {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
        internalDragClient = null
        img.remove_css_class("dragging")
        return false
      })
    })
    img.add_controller(drag)
    
    return img
  }

  const updateIcons = (id: number) => {
    const iconBox = iconBoxes.get(id)
    if (!iconBox) return

    let child = iconBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      iconBox.remove(child)
      child = next
    }

    const clients = hypr.get_clients().filter(c => c.workspace && c.workspace.id === id)
    const seen = new Set<string>()

    for (const client of clients) {
      if (!client.class || seen.has(client.class)) continue
      seen.add(client.class)
      iconBox.append(createIcon(client))
    }
  }

  const getNextId = (ids: number[]) => {
    const range = connector === "DP-2" ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10]
    return range.find(i => !ids.includes(i))
  }

  const refreshAfterMove = () => {
    update()
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 75, () => {
      update()
      return false
    })
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
      update()
      return false
    })
  }

  const plusButton = (
    <button
      class="workspace-plus"
      visible={false}
      onClicked={() => {
        const ids = hypr.get_workspaces()
          .filter(ws => ws.id > 0 && ws.monitor && ws.monitor.name === connector)
          .map(ws => ws.id)
        const nextId = getNextId(ids)
        if (nextId) {
          const active = hypr.focusedClient
          if (active) {
            const address = normalizeAddress(active.address)
            if (address) dispatchWorkspaceMove(nextId, address)
          }
        }
      }}
    >
      <label label="+" />
    </button>
  ) as Gtk.Button

  const update = () => {
    const activeId = hypr.focusedWorkspace?.id ?? -1
    const workspaces = hypr.get_workspaces()
      .filter(ws => ws.id > 0 && ws.monitor && ws.monitor.name === connector)
    
    const ids = workspaces.map(ws => ws.id).sort((a, b) => a - b)

    if (activeId > 0 && !ids.includes(activeId)) {
      const activeWs = hypr.get_workspaces().find(ws => ws.id === activeId)
      if (activeWs && activeWs.monitor && activeWs.monitor.name === connector) {
        ids.push(activeId)
        ids.sort((a, b) => a - b)
      }
    }

    let changed = false
    for (const [id, btn] of buttons) {
      if (!ids.includes(id)) {
        box.remove(btn)
        buttons.delete(id)
        iconBoxes.delete(id)
        changed = true
      }
    }

    ids.forEach(id => {
      if (!buttons.has(id)) {
        const iconBox = new Gtk.Box({ spacing: 4 })
        const btn = (
          <button 
            class="workspace-btn"
            onClicked={() => hypr.dispatch("workspace", `${id}`)}
          >
            <box spacing={6}>
              <label label={id === 10 ? "0" : `${id}`} />
              {iconBox}
            </box>
          </button>
        ) as Gtk.Button
        
        buttons.set(id, btn)
        iconBoxes.set(id, iconBox)
        changed = true
      }

      const btn = buttons.get(id)!
      if (id === activeId) btn.add_css_class("active")
      else btn.remove_css_class("active")

      updateIcons(id)

      const clients = hypr.get_clients().filter(c => c.workspace && c.workspace.id === id)
      if (clients.length > 0) btn.add_css_class("occupied")
      else btn.remove_css_class("occupied")
    })

    let child = box.get_first_child()
    let currentIds: number[] = []
    while (child) {
      if (child !== plusButton) {
        for (const [id, btn] of buttons) {
          if (btn === child) {
            currentIds.push(id)
            break
          }
        }
      }
      child = child.get_next_sibling()
    }

    if (changed || currentIds.length !== ids.length || currentIds.some((id, i) => id !== ids[i]) || plusButton.get_parent() !== box) {
      let c = box.get_first_child()
      while (c) {
        const next = c.get_next_sibling()
        box.remove(c)
        c = next
      }
      ids.forEach(id => {
        const b = buttons.get(id)
        if (b) box.append(b)
      })
      box.append(plusButton)
    }

    const nextId = getNextId(ids)
    plusButton.set_visible(!!nextId)
  }

  // GDK modifier mask — only correct when bar surface actually holds the pointer.
  // NOTE: GJS returns [ok, x, y, mask] for gdk_surface_get_device_position (4 values),
  // so we must destructure 4 elements to get the real mask in position [3].
  let lastGdkMask = 0

  const getHoveredButton = (
    curPos = hypr.cursorPosition,
    opts: { allowHyprFallback?: boolean; preferHyprCoords?: boolean } = {},
  ): Gtk.Widget | null => {
    const root = box.get_root() as Gtk.Window
    if (!root?.get_surface()) return null

    const [success, bx, by] = box.translate_coordinates(root, 0, 0)
    if (!success) return null

    const alloc = box.get_allocation()
    let isOverBox = false
    let pickX = 0
    let pickY = 0

    if (opts.preferHyprCoords) {
      const monRect = gdkmonitor.get_geometry()
      const scaleFactor = gdkmonitor.get_scale_factor()
      const hyprRelX = curPos.x / scaleFactor - monRect.x - bx
      const hyprRelY = curPos.y / scaleFactor - monRect.y - by
      if (hyprRelX >= -10 && hyprRelX <= alloc.width + 10 &&
          hyprRelY >= -5  && hyprRelY <= alloc.height + 5) {
        isOverBox = true
        pickX = hyprRelX
        pickY = hyprRelY
      }
    } else {
      const display = Gdk.Display.get_default()
      const seat = display?.get_default_seat()
      const pointer = seat?.get_pointer()
      if (!pointer) return null

      const [_ok, gdkX, gdkY, gdkMask] = root.get_surface().get_device_position(pointer)
      lastGdkMask = gdkMask

      isOverBox = gdkX >= bx - 10 && gdkX <= bx + alloc.width + 10 &&
                  gdkY >= by - 5  && gdkY <= by + alloc.height + 5
      pickX = gdkX - bx
      pickY = gdkY - by

      if (!isOverBox && opts.allowHyprFallback) {
        const monRect = gdkmonitor.get_geometry()
        const scaleFactor = gdkmonitor.get_scale_factor()
        const hyprRelX = curPos.x / scaleFactor - monRect.x - bx
        const hyprRelY = curPos.y / scaleFactor - monRect.y - by
        if (hyprRelX >= -10 && hyprRelX <= alloc.width + 10 &&
            hyprRelY >= -5  && hyprRelY <= alloc.height + 5) {
          isOverBox = true
          pickX = hyprRelX
          pickY = hyprRelY
        }
      }
    }

    if (!isOverBox) return null

    const within = (widget: Gtk.Widget) => {
      const alloc = widget.get_allocation()
      return (
        pickX >= alloc.x &&
        pickX <= alloc.x + alloc.width &&
        pickY >= alloc.y &&
        pickY <= alloc.y + alloc.height
      )
    }

    for (const id of [...buttons.keys()].sort((a, b) => a - b)) {
      const btn = buttons.get(id)
      if (btn && within(btn)) return btn
    }

    if (plusButton.get_visible() && within(plusButton)) return plusButton

    return null
  }

  const findTargetId = (widget: Gtk.Widget | null): number | null => {
    if (!widget) return null
    if (widget === plusButton) {
      const ids = hypr.get_workspaces()
        .filter(ws => ws.id > 0 && ws.monitor && ws.monitor.name === connector)
        .map(ws => ws.id)
      return getNextId(ids) ?? null
    }
    for (const [id, btn] of buttons) {
      if (btn === widget) return id
    }
    return null
  }

  const poll = () => {
    try {
      const curPos = hypr.cursorPosition
      const active = hypr.focusedClient as any
      const activeAddress = normalizeAddress(active?.address ?? null)
      const activeX = active?.x ?? active?.at?.[0]
      const activeY = active?.y ?? active?.at?.[1]
      const activePos = activeAddress && typeof activeX === "number" && typeof activeY === "number"
        ? `${activeX},${activeY}`
        : ""

      if (activeAddress !== lastActiveAddress) {
        lastActiveAddress = activeAddress
        lastActivePos = activePos
        lastActiveMoveMs = 0
        lastExternalDropTarget = null
      } else if (activePos && activePos !== lastActivePos) {
        lastActivePos = activePos
        lastActiveMoveMs = GLib.get_monotonic_time() / 1000
      }

      const nowMs = GLib.get_monotonic_time() / 1000
      const recentExternalMotion = !!activeAddress && !!lastActiveMoveMs && nowMs - lastActiveMoveMs < 5000
      const provisionalDrag = recentExternalMotion || internalDragClient !== null
      const buttonsMask = 0x7FFFFF00
      const prevGdkMask = lastGdkMask
      const hoveredButton = recentExternalMotion
        ? getHoveredButton(curPos, { preferHyprCoords: true })
        : getHoveredButton(curPos, { allowHyprFallback: provisionalDrag })
      const isGdkPressed = (lastGdkMask & buttonsMask) !== 0
      const wasGdkPressed = (prevGdkMask & buttonsMask) !== 0
      const hoveredId = findTargetId(hoveredButton)
      const isExternalDrag = !!activeAddress && hoveredId !== null && (recentExternalMotion || isGdkPressed)
      const isActualDrag = isExternalDrag || internalDragClient !== null

      if (isExternalDrag || hoveredId !== null) {
        debugLog(
          `drag=${isExternalDrag} recentMotion=${recentExternalMotion} active=${activeAddress ?? "none"} pos=${activePos || "none"} cursor=${curPos.x},${curPos.y} hovered=${hoveredId ?? "none"} gdkPressed=${isGdkPressed}`,
        )
      }

      if (hoveredButton) {
        box.add_css_class("hover")

        if (isGdkPressed && activeAddress && !externalPressAddress) {
          externalPressAddress = activeAddress
          externalPressStartX = curPos.x
          externalPressStartY = curPos.y
          externalPressDragged = false
        }

        if (isGdkPressed && externalPressAddress) {
          if (Math.abs(curPos.x - externalPressStartX) + Math.abs(curPos.y - externalPressStartY) > 12)
            externalPressDragged = true
          externalPressHovered = hoveredId
        }

        if (hoveredButton !== currentTarget) {
          if (currentTarget) currentTarget.remove_css_class("drop-target")
          currentTarget = hoveredButton
        }
        if (currentTarget) {
          if (isActualDrag) currentTarget.add_css_class("drop-target")
          else currentTarget.remove_css_class("drop-target")
        }

        if (wasGdkPressed && !isGdkPressed && externalPressDragged && externalPressAddress && currentTarget) {
          const targetId = findTargetId(currentTarget)
          if (targetId !== null) {
            debugLog(`release-dispatch target=${targetId} address=${externalPressAddress}`)
            dispatchWorkspaceMove(targetId, externalPressAddress)
          }
        }

        // Drop: icon drag within the bar — GDK surface has pointer focus so mask is correct
        if (wasGdkPressed && !isGdkPressed && internalDragClient && currentTarget) {
          const targetId = findTargetId(currentTarget)
          if (targetId !== null) {
            const draggedAddress = normalizeAddress(internalDragClient.address)
            if (draggedAddress)
              dispatchWorkspaceMove(targetId, draggedAddress)
          }
        }
      } else {
        if (!isActualDrag) box.remove_css_class("hover")
        if (currentTarget) {
          currentTarget.remove_css_class("drop-target")
          currentTarget = null
        }
      }

      if (!isGdkPressed) {
        externalPressAddress = null
        externalPressHovered = null
        externalPressDragged = false
        lastExternalDropTarget = null
      }
    } catch (e) {
      // console.error("Workspaces poller error:", e)
    }

    return true
  }

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, poll)

  update()
  hypr.connect("notify::focused-workspace", update)
  hypr.connect("notify::workspaces", update)
  hypr.connect("notify::clients", update)

  return box
}
