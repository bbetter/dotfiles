import { createPoll } from "ags/time"

export function Clock() {
  const time = createPoll("", 1000, () => {
    const now = new Date()
    return now.toLocaleTimeString("uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
    }) + "  " + now.toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  })

  return (
    <button class="clock" tooltipText={time}>
      <label label={time} />
    </button>
  )
}
