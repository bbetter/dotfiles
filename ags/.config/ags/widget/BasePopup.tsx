import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { positionUnder } from "./utils/positioning"
import { updateBackdrop } from "./PopupManager"
import { closeSidebar } from "./sidebar/state"
import { closeAllPopups } from "./PopupManager"

interface BasePopupProps {
    name: string
    className: string
    baseClassName?: string // New: allow specific prefix like 'bt-popup'
    gdkmonitor: Gdk.Monitor
    anchor: Astal.WindowAnchor
    defaultWidth: number
    child: Gtk.Widget
    marginTop?: number
    marginRight?: number
    marginLeft?: number
}

export interface PopupHandle {
    window: Gtk.Window
    revealer: Gtk.Revealer
    arrow: Gtk.Box
    toggle: (sourceWidget?: Gtk.Widget) => void
}

export function createPopup(props: BasePopupProps): PopupHandle {
    const { name, className, baseClassName, gdkmonitor, anchor, defaultWidth, child, marginTop = 4, marginRight = 8, marginLeft = 8 } = props

    const prefix = baseClassName || className.toLowerCase()
    const arrowEl = new Gtk.Box()
    arrowEl.add_css_class(`${prefix}-arrow`)

    const revealer = new Gtk.Revealer({
        transitionType: Gtk.RevealerTransitionType.SLIDE_DOWN,
        transitionDuration: 200,
        hexpand: true,
        child: (
            <box orientation={1} class={`${prefix}-outer`} hexpand>
                <box class={`${prefix}-arrow-row`} hexpand>
                    {arrowEl}
                </box>
                <box orientation={1} class={`${prefix}-content`}>
                    {child}
                </box>
            </box>
        ) as Gtk.Widget
    })

    const win = (
        <window
            name={name}
            visible={false}
            gdkmonitor={gdkmonitor}
            exclusivity={Astal.Exclusivity.NORMAL}
            layer={Astal.Layer.OVERLAY}
            anchor={anchor}
            application={app}
            class={className}
            marginTop={marginTop}
            marginRight={marginRight}
            marginLeft={marginLeft}
            widthRequest={defaultWidth}
        >
            {revealer}
        </window>
    ) as Gtk.Window

    const toggle = (sourceWidget?: Gtk.Widget) => {
        if (win.visible && revealer.revealChild) {
            revealer.revealChild = false
            setTimeout(() => {
                if (!revealer.revealChild) {
                    win.visible = false
                    updateBackdrop()
                }
            }, 200)
        } else {
            closeSidebar()
            closeAllPopups(win)
            if (sourceWidget) {
                positionUnder(win, gdkmonitor, arrowEl, sourceWidget, defaultWidth)
            }
            win.visible = true
            revealer.revealChild = true
            updateBackdrop()
        }
    }

    return { window: win, revealer, arrow: arrowEl, toggle }
}
