#!/bin/bash
count=$(swaync-client -c 2>/dev/null || echo "0")
if [ "$count" -gt 0 ]; then
    echo "{\"text\":\" $count\", \"class\":\"notification\"}"
else
    echo "{\"text\":\"\", \"class\":\"none\"}"
fi
