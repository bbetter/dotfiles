import { Astal, Gtk, Gdk } from "ags/gtk4"

export const ARROW_WIDTH = 20

/**
 * Positions a popup window under a source widget, handling multi-monitor and anchoring.
 */
export function positionUnder(
    popup: Gtk.Window,
    monitor: Gdk.Monitor,
    arrowEl: Gtk.Box,
    sourceWidget: Gtk.Widget,
    defaultWidth: number
) {
    const root = sourceWidget.get_root() as any
    if (!root) return
    const [ok, bx] = sourceWidget.translate_coordinates(root, 0, 0)
    if (!ok) return

    const bw = sourceWidget.get_allocated_width()
    const monitorWidth = monitor.get_geometry().width
    
    // Use modulo to ensure local coordinates if Gtk reports global ones in multi-monitor
    const localBtnCenterX = (bx + bw / 2) % monitorWidth

    // Measure actual width of the content
    const content = (popup as any).get_child() as Gtk.Revealer
    const outerBox = content.get_child() as Gtk.Box
    const [, naturalWidth] = outerBox.measure(Gtk.Orientation.HORIZONTAL, -1)
    const actualWidth = Math.max(defaultWidth, naturalWidth)

    const anchor = (popup as any).anchor
    const isRight = !!(anchor & Astal.WindowAnchor.RIGHT)

    if (isRight) {
        const marginRight = Math.max(4, Math.min(
            monitorWidth - actualWidth - 4,
            monitorWidth - localBtnCenterX - actualWidth / 2,
        ))
        ;(popup as any).marginRight = marginRight
        
        if (arrowEl) {
            const windowLeftX = monitorWidth - marginRight - actualWidth
            const distFromLeft = localBtnCenterX - windowLeftX
            arrowEl.set_halign(Gtk.Align.START)
            arrowEl.set_margin_start(Math.max(4, Math.round(distFromLeft - ARROW_WIDTH / 2)))
        }
    } else {
        let marginLeft = localBtnCenterX - actualWidth / 2
        marginLeft = Math.max(4, Math.min(monitorWidth - actualWidth - 4, marginLeft))
        ;(popup as any).marginLeft = marginLeft

        if (arrowEl) {
            const distFromLeft = localBtnCenterX - marginLeft
            arrowEl.set_halign(Gtk.Align.START)
            arrowEl.set_margin_start(Math.max(4, Math.round(distFromLeft - ARROW_WIDTH / 2)))
        }
    }
}
