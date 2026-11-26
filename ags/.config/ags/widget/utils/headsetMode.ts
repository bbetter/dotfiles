import { exec } from "ags/process"

// The Jieli headset enumerates twice: as the wireless dongle and as the USB cable.
// Both show the same AstalWp description, so the mode comes from the USB serial in
// the PipeWire node name. Update if the headset is re-paired or replaced.
const DONGLE_SERIAL = "4250325437333805"
const CABLE_SERIAL = "4150353030343319"

export type HeadsetMode = "dongle" | "cable"

// PipeWire object.serial -> headset mode, for sinks or sources. One pactl call per
// device-list change (event-driven); AstalWp's Endpoint.serial is the same object.serial.
export function headsetModes(kind: "sinks" | "sources"): Map<number, HeadsetMode> {
  const modes = new Map<number, HeadsetMode>()
  try {
    const out = exec(`pactl list ${kind}`)
    // Blocks start with "Sink #<n>" / "Source #<n>" at column 0.
    for (const block of out.split(/^(?:Sink|Source) #/m).slice(1)) {
      const serial = block.match(/object\.serial = "(\d+)"/)?.[1]
      const node = block.match(/node\.name = "([^"]+)"/)?.[1] ?? ""
      if (!serial) continue
      if (node.includes(CABLE_SERIAL)) modes.set(Number(serial), "cable")
      else if (node.includes(DONGLE_SERIAL)) modes.set(Number(serial), "dongle")
    }
  } catch { /* pactl unavailable: no mode labels */ }
  return modes
}
