import Hyprland from "gi://AstalHyprland"
const hypr = Hyprland.get_default()
hypr.connect("event", (self, name, data) => {
    console.log(`Event: ${name} | Data: ${data}`)
})
