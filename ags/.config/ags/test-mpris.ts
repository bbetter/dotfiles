
import Mpris from "gi://AstalMpris"

const mpris = Mpris.get_default()
console.log("Players:", mpris.players.length)
mpris.players.forEach(p => {
    console.log(`- ${p.busName}: ${p.playbackStatus} - ${p.title} by ${p.artist}`)
})
