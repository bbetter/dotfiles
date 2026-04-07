import app from "ags/gtk4/app"

const POPUP_NAMES = ["network-popup", "audio-popup", "bluetooth-popup"]
const BACKDROP_PREFIX = "popup-backdrop-"

function isPopup(name: string) {
  return POPUP_NAMES.includes(name)
}

export function anyPopupOpen(): boolean {
  return app.get_windows().some(w => isPopup(w.name) && w.visible)
}

export function updateBackdrop() {
  const open = anyPopupOpen()
  for (const w of app.get_windows()) {
    if (w.name?.startsWith(BACKDROP_PREFIX)) w.visible = open
  }
}

/** Close all registered popups, optionally keeping one open. Does not touch sidebar. */
export function closeAllPopups(except?: { name: string } | null) {
  for (const w of app.get_windows()) {
    if (isPopup(w.name) && w !== except) w.visible = false
  }
  updateBackdrop()
}
