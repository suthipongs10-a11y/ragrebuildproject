#!/usr/bin/env bash
# Unpacks a server bundle over the installed one and restarts the service. Run as
# root on the VPS:
#
#     bash install-bundle.sh                       # uses /root/rorebuild-server.tar
#     bash install-bundle.sh /path/to/bundle.tar
#
# The chmod near the bottom is why this is a script rather than three lines in a
# document. Compress-Archive on Windows writes no unix permissions into the zip, so
# unzip has nothing to restore and falls back to the umask: every file arrives
# without its execute bit, runtimes/linux-x64/native/libe_sqlite3.so among them.
# The runtime loads that one with dlopen, dlopen needs execute permission, and the
# server aborts on its first database call with "Unable to load shared library
# 'e_sqlite3'" and Permission denied against a file that is plainly sitting right
# there, readable, in the directory it just named. Nothing in that says chmod.
set -euo pipefail

DEST=/opt/rorebuild/server

BUNDLE="${1:-}"
if [ -z "$BUNDLE" ]; then
    if   [ -f /root/rorebuild-server.tar ]; then BUNDLE=/root/rorebuild-server.tar
    elif [ -f /root/rorebuild-server.zip ]; then BUNDLE=/root/rorebuild-server.zip
    else echo "No bundle at /root/rorebuild-server.tar or .zip" >&2; exit 1
    fi
fi

[ -f "$BUNDLE" ] || { echo "No bundle at $BUNDLE" >&2; exit 1; }
[ -d "$DEST" ] || { echo "No server folder at $DEST - run vps-setup.sh first." >&2; exit 1; }

echo "Stopping the server..."
systemctl stop rorebuild 2>/dev/null || true

echo "Clearing the folders the bundle replaces..."
# Unpacking over the top leaves behind every file the bundle no longer has. That is not
# a tidiness question: a test NPC was taken out upstream by renaming its script to
# _TestFinale.txt, the rename arrived as a new file, the old TestFinale.txt stayed where
# it was, and the server went on compiling it - the NPC was still standing in the field
# on a server built from a tree that had not held it for days. Anything dropped or
# renamed upstream needs the same treatment, so the folders the bundle owns whole are
# cleared first rather than merged into.
#
# Cache is in that list because it holds the compiled script assembly. Leaving a script
# build keyed to the files that were here last time is how a stale NPC survives even a
# clean ServerData.
#
# The character database, the data protection keys and the logs belong to this machine
# and are not in the bundle, so they are not touched.
for dir in ServerData WebClient walkdata Cache; do
    rm -rf "${DEST:?}/$dir"
done

echo "Unpacking $BUNDLE..."
case "$BUNDLE" in
    *.tar|*.tar.gz|*.tgz)
        tar -xf "$BUNDLE" -C "$DEST"
        ;;
    *.zip)
        # A zip built on Windows carries its names as UTF-8 and unzip reads them back
        # through a legacy codepage, so every sprite with a Korean name - which is
        # every player sprite - lands under a mangled one and the player character
        # does not render. The file count still matches, so nothing looks wrong.
        # publish.ps1 makes a .tar now; this branch is for an old bundle.
        echo "WARNING: this is a zip. Korean sprite file names will be mangled and player" >&2
        echo "         characters will not render. Build the bundle again with the current" >&2
        echo "         publish.ps1, which writes a .tar." >&2
        unzip -q -o "$BUNDLE" -d "$DEST"
        ;;
    *)
        echo "Do not know how to unpack $BUNDLE" >&2; exit 1
        ;;
esac

echo "Setting ownership and permissions..."
chown -R rorebuild:rorebuild /opt/rorebuild
find "$DEST" -type d -exec chmod 755 {} +
find "$DEST" -type f \( -name '*.so' -o -name '*.so.*' \) -exec chmod 755 {} +

echo "Starting the server..."
systemctl start rorebuild
sleep 6

if systemctl is-active --quiet rorebuild; then
    echo
    echo "Running. Check these four lines are in the log:"
    echo "    [Lockdown] LiveServer is on"
    echo "    [Lockdown] Created the GM account 'gmrebuild'   (first boot only)"
    echo "    [Gate] Online players: 25 ... Accounts: N of 30"
    echo "    Serving the browser build from $DEST/WebClient"
    echo
    echo "    journalctl -u rorebuild -n 60 --no-pager"
else
    echo "The server did not start. The end of the log:" >&2
    journalctl -u rorebuild --no-pager -n 40 >&2
    exit 1
fi
