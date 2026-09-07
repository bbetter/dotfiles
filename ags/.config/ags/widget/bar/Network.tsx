import { createBinding, createComputed } from "gnim"
import { Gtk, Gdk } from "ags/gtk4"
import AstalNetwork from "gi://AstalNetwork"
import { toggleNetworkPopup } from "../NetworkPopup"
import { bindActiveClass } from "../utils/popupActiveClass"

interface NetworkState {
  text: string
  tooltip: string
}

function wifiIcon(strength: number): string {
  if (strength >= 75) return "󰤨"
  if (strength >= 50) return "󰤥"
  if (strength >= 25) return "󰤢"
  return "󰤟"
}

function internetText(v: AstalNetwork.Internet): string {
  if (v === AstalNetwork.Internet.CONNECTED) return "Connected"
  if (v === AstalNetwork.Internet.CONNECTING) return "Connecting…"
  return "Disconnected"
}

export function NetworkIndicator({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const monitorName = gdkmonitor.get_connector() ?? "default"
  const network = AstalNetwork.get_default()

  // Event-driven via AstalNetwork (same binding the NetworkPopup uses) —
  // no more `python3 network.py` every 5 seconds.
  const primary = createBinding(network, "primary")
  const ssid = createBinding(network, "wifi", "ssid")
  const strength = createBinding(network, "wifi", "strength")
  const wiredInternet = createBinding(network, "wired", "internet")
  const wiredSpeed = createBinding(network, "wired", "speed")

  const state = createComputed<NetworkState>(() => {
    const p = primary()
    if (p === AstalNetwork.Primary.WIRED) {
      const speed = wiredSpeed() ?? 0
      return {
        text: "󰈀 LAN",
        tooltip: `Ethernet · ${internetText(wiredInternet())}` + (speed > 0 ? ` · ${speed} Mb/s` : ""),
      }
    }
    if (p === AstalNetwork.Primary.WIFI) {
      const s = strength() ?? 0
      const name = ssid() ?? "Wi-Fi"
      return { text: `${wifiIcon(s)} ${name}`, tooltip: `Wi-Fi\nSSID: ${name}\nSignal: ${s}%` }
    }
    return { text: "󰤭", tooltip: "No network connection" }
  })

  const btn = (
    <button
      class="network"
      tooltipText={state.as(s => s.tooltip)}
      onClicked={() => toggleNetworkPopup(btn)}
    >
      <label label={state.as(s => s.text)} />
    </button>
  ) as Gtk.Button

  bindActiveClass(btn, "network-popup", monitorName)

  return btn
}
