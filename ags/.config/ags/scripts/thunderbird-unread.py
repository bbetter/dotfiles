#!/usr/bin/env python3
import json, glob, os, sys, re

SKIP = re.compile(
    r'/(Spam|Junk|Trash|Sent|Drafts|All Mail|Archive|\[Gmail\]\.sbd)/',
    re.IGNORECASE
)

profile_dirs = glob.glob(os.path.expanduser('~/.thunderbird/*.default-release'))
if not profile_dirs:
    print(0)
    sys.exit(0)

cache_path = os.path.join(profile_dirs[0], 'folderCache.json')
try:
    with open(cache_path) as f:
        cache = json.load(f)
except Exception:
    print(0)
    sys.exit(0)

total = 0
for key, val in cache.items():
    if not isinstance(val, dict):
        continue
    if SKIP.search(key):
        continue
    n = val.get('totalUnreadMsgs', 0)
    if n > 0:
        total += n

print(total)
