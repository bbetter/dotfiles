import { createExternal } from "gnim"
import GLib from "gi://GLib"

/**
 * Accessor that recomputes `snapshot()` once per minute, realigned to the :00
 * boundary each tick. One timer wake-up per displayed minute instead of a 1 Hz
 * poll that repaints the same value 60 times.
 */
export function createMinuteClock<T>(snapshot: () => T) {
  return createExternal<T>(snapshot(), (set) => {
    let id = 0
    const schedule = () => {
      id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60000 - (Date.now() % 60000), () => {
        set(snapshot())
        schedule()
        return GLib.SOURCE_REMOVE
      })
    }
    schedule()
    return () => {
      if (id) GLib.source_remove(id)
    }
  })
}
