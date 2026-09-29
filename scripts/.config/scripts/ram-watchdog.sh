#!/bin/bash

# Warns via swaync before the system gets swap-thrashed into unresponsiveness.
# See 2026-09-28: MemAvailable dropped to ~3Gi and swap climbed to ~19Gi/31Gi
# after wallpaper engine leaked memory + CS2 launched on top of it — by the
# time it was that bad, even opening a system monitor stalled. This polls
# early enough that a notification still has a chance to get through.

POLL_SECONDS=20

WARN_AVAIL_MB=8192
WARN_SWAP_PCT=40
CRIT_AVAIL_MB=3072
CRIT_SWAP_PCT=60

# Recovery needs a bit of margin over the entry thresholds so it doesn't
# flap a notification every poll while sitting right at the line.
OK_AVAIL_MB=10240
OK_SWAP_PCT=30

state="ok"

read_mem() {
  local avail_kb swap_total_kb swap_free_kb
  avail_kb=$(awk '/MemAvailable:/{print $2}' /proc/meminfo)
  swap_total_kb=$(awk '/SwapTotal:/{print $2}' /proc/meminfo)
  swap_free_kb=$(awk '/SwapFree:/{print $2}' /proc/meminfo)

  AVAIL_MB=$((avail_kb / 1024))
  if [ "$swap_total_kb" -gt 0 ]; then
    SWAP_PCT=$(((swap_total_kb - swap_free_kb) * 100 / swap_total_kb))
  else
    SWAP_PCT=0
  fi
}

notify() {
  local urgency="$1" title="$2" body="$3"
  notify-send -u "$urgency" -a "RAM watchdog" "$title" "$body"
}

while true; do
  read_mem

  if [ "$AVAIL_MB" -lt "$CRIT_AVAIL_MB" ] || [ "$SWAP_PCT" -ge "$CRIT_SWAP_PCT" ]; then
    level="critical"
  elif [ "$AVAIL_MB" -lt "$WARN_AVAIL_MB" ] || [ "$SWAP_PCT" -ge "$WARN_SWAP_PCT" ]; then
    level="warning"
  elif [ "$AVAIL_MB" -ge "$OK_AVAIL_MB" ] && [ "$SWAP_PCT" -lt "$OK_SWAP_PCT" ]; then
    level="ok"
  else
    level="$state" # dead zone between warn-exit and ok-entry — hold state
  fi

  if [ "$level" != "$state" ]; then
    case "$level" in
    critical)
      echo "🔴 critical: available=${AVAIL_MB}MB swap=${SWAP_PCT}%"
      notify critical "Памʼять на межі" "Вільно ${AVAIL_MB} МБ, своп ${SWAP_PCT}%. Закрий щось або 'wall reload' — інакше може зависнути, як 28.09."
      ;;
    warning)
      echo "🟡 warning: available=${AVAIL_MB}MB swap=${SWAP_PCT}%"
      notify normal "Памʼяті стає мало" "Вільно ${AVAIL_MB} МБ, своп ${SWAP_PCT}%."
      ;;
    ok)
      echo "🟢 recovered: available=${AVAIL_MB}MB swap=${SWAP_PCT}%"
      ;;
    esac
    state="$level"
  fi

  sleep "$POLL_SECONDS"
done
