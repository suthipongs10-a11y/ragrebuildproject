#!/usr/bin/env bash
# Build Eggbound and put it live on THIS machine (2026-10-15) — the way to publish when working on the VPS itself
# (vps-dev-setup.sh). nginx (vps-setup.sh) serves /var/www/eggbound; the page gets the head the Artifact used to add.
#   bash publish.sh          typecheck + tests + build + publish
#   bash publish.sh --quick  build + publish only
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WEB="${WEB:-/var/www/eggbound}"
cd "$HERE/../game"
if [ "${1:-}" != --quick ]; then npm run typecheck; npm test; fi
npm run build
[ -w "$WEB" ] || { echo "เขียน $WEB ไม่ได้ — รันด้วยผู้ใช้ eggbound (su - eggbound)"; exit 1; }
TMP="$WEB/.index.html.new"
cat "$HERE/page-head.html" dist/index.html > "$TMP"
chmod 644 "$TMP"; mv -f "$TMP" "$WEB/index.html"   # same folder: the swap is atomic, players never get half a page
PORT="$(grep -m1 -oE 'listen [0-9]+' /etc/nginx/sites-available/eggbound.conf 2>/dev/null | grep -oE '[0-9]+' || echo 8080)"
echo "ขึ้นเว็บแล้ว ($(du -h "$WEB/index.html" | cut -f1)) — http://$(curl -fsS --max-time 4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}'):$PORT/"
