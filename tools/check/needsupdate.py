#!/usr/bin/env python3
"""Says whether a change makes updateclient.bat necessary, and why.

The client does not compile RebuildSharedData from source - it uses a copy of the built
library that updateclient.bat drops into Assets/Data. So a packet type or an enum added
to that project exists for the server the moment it builds, and does not exist for the
client until somebody runs the script.

The symptom is Unity dropping into Safe Mode with "PacketType does not contain a
definition for ..." - which reads like the code is wrong when the code is fine and the
library beside it is a version behind. That mistake was made by telling somebody the
script was not needed because no CSV had changed, which is only half the rule.

Run it with a git range, e.g.  needsupdate.py HEAD~3..HEAD
"""
import re
import subprocess
import sys

RANGE = sys.argv[1] if len(sys.argv) > 1 else "HEAD~1..HEAD"

#What the script actually rebuilds and copies, and why each one matters
WATCHED = {
    "RoRebuildServer/RebuildSharedData/": "the shared library the client is compiled against",
    "RoRebuildServer/GameConfig/": "the generated config the client reads",
    "RoRebuildServer/GameConfig.Generator/": "the source generator behind that config",
}

changed = subprocess.check_output(["git", "diff", "--name-only", RANGE]).decode().split()
reasons = {}
for f in changed:
    for prefix, why in WATCHED.items():
        if f.startswith(prefix):
            reasons.setdefault(why, []).append(f)

print(f"--- {RANGE}: {len(changed)} file(s) ---")
if not reasons:
    print("\nnothing here reaches the client through a build step.")
    print("updateclient.bat is NOT required for this change.")
    sys.exit(0)

print()
for why, files in reasons.items():
    print(f"  {why}:")
    for f in sorted(files)[:6]:
        print(f"    {f}")
    if len(files) > 6:
        print(f"    ... and {len(files) - 6} more")
    print()

#the specific thing that breaks, named, so the warning is worth reading
shared = [f for f in changed if f.startswith("RoRebuildServer/RebuildSharedData/")]
if shared:
    added = subprocess.check_output(["git", "diff", RANGE, "--"] + shared).decode()
    names = sorted(set(re.findall(r"^\+\s*(\w+),\s*$", added, re.M))
                   | set(re.findall(r"^\+public enum (\w+)", added, re.M)))
    if names:
        print("  names the client cannot see until the library is copied:")
        print("    " + ", ".join(names[:12]) + (" ..." if len(names) > 12 else ""))
        print()

print("updateclient.bat IS REQUIRED. Without it Unity drops into Safe Mode with")
print("\"does not contain a definition for ...\" against code that is perfectly fine.")
sys.exit(1)
