#!/usr/bin/env bash
# Unpacks a server bundle over the installed one and restarts the service. Run as
# root on the VPS:
#
#     bash install-bundle.sh                       # uses /root/rorebuild-server.zip
#     bash install-bundle.sh /path/to/bundle.zip
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

ZIP="${1:-/root/rorebuild-server.zip}"
DEST=/opt/rorebuild/server

[ -f "$ZIP" ] || { echo "No bundle at $ZIP" >&2; exit 1; }
[ -d "$DEST" ] || { echo "No server folder at $DEST - run vps-setup.sh first." >&2; exit 1; }

echo "Stopping the server..."
systemctl stop rorebuild 2>/dev/null || true

echo "Unpacking $ZIP..."
# The character database, the data protection keys and the script cache are not in
# the bundle, so they are left exactly as they are by unpacking over the top.
unzip -q -o "$ZIP" -d "$DEST"

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
