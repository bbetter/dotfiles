#!/bin/sh
count=$(swaync-client -c)
[ "$count" -eq 0 ] && exit 0
echo "{\"text\": \"🔔 $count\"}"

