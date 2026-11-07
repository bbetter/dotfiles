#!/usr/bin/env bash

# Warns when audio is actually playing out of a sink other than the
# headphones/earbuds while those are connected, during quiet hours. Triggered
# by the 2026-11-07 case: Jieli earbuds connected and carrying Discord voice
# fine, but a Firefox tab's music was routed to the speakers instead —
# everyone else in the house heard it, not the warning-needing listener.
#
# Deliberately NOT "headphones connected + it's late -> notify": that would
# fire nonstop during normal late-night headphone listening. Only an actual
# sink mismatch (something playing on a sink that isn't the headphone sink)
# counts as a leak.

set -uo pipefail

STATE_DIR="$HOME/.cache/audio-leak-watchdog"
LOGFILE="$STATE_DIR/watchdog.log"
mkdir -p "$STATE_DIR"

POLL_SECONDS=15        # how often to check during quiet hours
IDLE_POLL_SECONDS=60   # how often to check outside quiet hours (just waiting for the window)
QUIET_START_HOUR=22    # quiet hours start (0-23)
QUIET_END_HOUR=8        # quiet hours end (0-23), wraps past midnight
COOLDOWN_SECONDS=300    # minimum gap between repeat notifications for an ongoing leak

# Substring match (case-insensitive) against `pactl list short sinks` names.
# Update this if the earbuds/dongle hardware changes.
HEADPHONE_SINK_PATTERN="Jieli"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >>"$LOGFILE"; }

notify() {
  command -v notify-send >/dev/null 2>&1 || return 0
  notify-send -u critical -a "Audio leak watchdog" "$1" "$2"
}

in_quiet_hours() {
  local h
  h=$(date +%H); h=$((10#$h))
  if [ "$QUIET_START_HOUR" -le "$QUIET_END_HOUR" ]; then
    [ "$h" -ge "$QUIET_START_HOUR" ] && [ "$h" -lt "$QUIET_END_HOUR" ]
  else
    [ "$h" -ge "$QUIET_START_HOUR" ] || [ "$h" -lt "$QUIET_END_HOUR" ]
  fi
}

find_headphone_sink_id() {
  pactl list short sinks 2>/dev/null | grep -i "$HEADPHONE_SINK_PATTERN" | awk '{print $1}' | head -1
}

find_leaks() {
  local headphone_id="$1"
  pactl list sink-inputs 2>/dev/null | awk -v target="$headphone_id" '
    BEGIN { RS="" ; FS="\n" }
    {
      sink=""; corked=""; appname=""; medianame="";
      for (i=1; i<=NF; i++) {
        line=$i
        if (line ~ /^\tSink: /)        { sink=line;   sub(/^\tSink: /, "", sink) }
        if (line ~ /^\tCorked: /)      { corked=line; sub(/^\tCorked: /, "", corked) }
        if (line ~ /application\.name = /) { appname=line;   sub(/.*application\.name = "/, "", appname);   sub(/".*/, "", appname) }
        if (line ~ /media\.name = /)       { medianame=line; sub(/.*media\.name = "/, "", medianame); sub(/".*/, "", medianame) }
      }
      if (corked == "no" && sink != "" && sink != target) {
        printf "%s: %s (sink %s)\n", appname, medianame, sink
      }
    }
  '
}

log "watchdog started (quiet=${QUIET_START_HOUR}:00-${QUIET_END_HOUR}:00 pattern='${HEADPHONE_SINK_PATTERN}' cooldown=${COOLDOWN_SECONDS}s)"

last_notify=0

while true; do
  if in_quiet_hours; then
    headphone_id=$(find_headphone_sink_id)
    if [ -n "$headphone_id" ]; then
      leaks=$(find_leaks "$headphone_id")
      if [ -n "$leaks" ]; then
        now=$(date +%s)
        if (( now - last_notify >= COOLDOWN_SECONDS )); then
          summary=$(echo "$leaks" | sort -u | paste -sd'; ' -)
          log "leak detected while headphones (sink $headphone_id) connected: $summary"
          notify "Навухи на, але не весь звук туди" "Грає не через навухи після ${QUIET_START_HOUR}:00: ${summary}"
          last_notify=$now
        fi
      fi
    fi
    sleep "$POLL_SECONDS"
  else
    sleep "$IDLE_POLL_SECONDS"
  fi
done
