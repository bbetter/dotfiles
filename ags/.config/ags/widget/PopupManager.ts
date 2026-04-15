import app from "ags/gtk4/app"

const POPUP_NAMES = ["network-popup", "audio-popup", "bluetooth-popup", "calendar-popup"]
const BACKDROP_PREFIX = "popup-backdrop-"

function isPopup(name: string | null) {
  if (!name) return false
  return POPUP_NAMES.some(prefix => name.startsWith(prefix))
}

export function anyPopupOpen(): boolean {
  return app.get_windows().some(w => isPopup(w.name) && w.visible)
}

export function updateBackdrop() {
  const windows = app.get_windows()
  const backdrops = windows.filter(w => w.name?.startsWith(BACKDROP_PREFIX))
  
  for (const backdrop of backdrops) {
    const monitorName = backdrop.name?.replace(BACKDROP_PREFIX, "")
    const popupsOnThisMonitor = windows.filter(w => 
      isPopup(w.name) && w.name?.endsWith(`-${monitorName}`) && w.visible
    )
    backdrop.visible = popupsOnThisMonitor.length > 0
  }
}

/** Close all registered popups, optionally keeping one open. Does not touch sidebar. */
export function closeAllPopups(except?: { name: string | null } | null) {
  for (const w of app.get_windows()) {
    if (isPopup(w.name) && w !== except) w.visible = false
  }
  updateBackdrop()
}
