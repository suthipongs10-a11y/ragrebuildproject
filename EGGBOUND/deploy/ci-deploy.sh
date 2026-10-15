#!/usr/bin/env bash
# Upload a finished build to the VPS (2026-10-15) — run by .github/workflows/eggbound-vps.yml.
#   EGGBOUND_VPS (secret) = the block printed by deploy/vps-setup.sh: url=… line, user@host:port, known_hosts line,
#   private key. Pasted text may carry blank lines, CRs or the ---- rules around it, so each part is found by pattern.
# usage: EGGBOUND_VPS=... bash ci-deploy.sh <dist dir>
set -euo pipefail
DIST="${1:?dist dir}"
[ -n "${EGGBOUND_VPS:-}" ] || { echo "EGGBOUND_VPS is empty"; exit 1; }

umask 077
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
printf '%s\n' "$EGGBOUND_VPS" | tr -d '\r' > "$W/all"
DEST="$(grep -Em1 '^[A-Za-z0-9_.-]+@[^ :]+:[0-9]+$' "$W/all" || true)"
grep -Em1 ' (ssh-ed25519|ecdsa-sha2-[a-z0-9]+|ssh-rsa) ' "$W/all" > "$W/known_hosts" || true
sed -n '/-----BEGIN OPENSSH PRIVATE KEY-----/,/-----END OPENSSH PRIVATE KEY-----/p' "$W/all" > "$W/key"
[ -n "$DEST" ] && [ -s "$W/known_hosts" ] && [ -s "$W/key" ] || {
  echo "EGGBOUND_VPS is missing a part (user@host:port / host key / private key) — paste the whole block from vps-setup.sh again"; exit 1; }

# the build is the Artifact body (no doctype/charset/viewport — the Artifact page adds them); hosting it ourselves
# needs that head, or phones lay it out 980px wide and may misread the Thai text
mkdir -p "$W/site"
{ printf '%s\n' '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#1d2619">'
  cat "$DIST/index.html"; } > "$W/site/index.html"
chmod 644 "$W/site/index.html"; chmod 755 "$W/site"

HOST="${DEST%:*}"; PORT="${DEST##*:}"
# the key may only run rrsync into the game folder (see vps-setup.sh), so the remote path is the folder itself
rsync -rtz --delete \
  -e "ssh -i $W/key -p $PORT -o UserKnownHostsFile=$W/known_hosts -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -o BatchMode=yes" \
  "$W/site/" "$HOST:"
echo "deployed $(du -sh "$W/site/index.html" | cut -f1) to the VPS"
