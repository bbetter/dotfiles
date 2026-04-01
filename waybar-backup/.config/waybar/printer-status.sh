#!/bin/bash

STATUS=$(lpstat -o 2>/dev/null)

if [ -z "$STATUS" ]; then
    exit 0
fi

# Count jobs
JOB_COUNT=$(echo "$STATUS" | grep -c .)

# Get first job's status line (page progress if available)
PROGRESS=$(lpstat -l -o 2>/dev/null | grep "Status:" | head -1 | sed 's/.*Status: //')

if [ -n "$PROGRESS" ] && [ "$PROGRESS" != "Unable to locate printer." ]; then
    TOOLTIP="$PROGRESS"
else
    TOOLTIP=$(echo "$STATUS" | head -1 | awk '{print $1}')
fi

if [ "$JOB_COUNT" -eq 1 ]; then
    TEXT="🖨 1 job"
else
    TEXT="🖨 $JOB_COUNT jobs"
fi

echo "{\"text\":\"$TEXT\", \"class\":\"printing\", \"tooltip\":\"$TOOLTIP\"}"
