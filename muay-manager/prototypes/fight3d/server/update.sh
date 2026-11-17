#!/usr/bin/env bash
# Brings the game on this server up to date with its branch on GitHub.
# Run as root (the systemd timer does): git, npm and the build run as the game's user, then the service is restarted.
#   update.sh           do nothing when the branch has not moved
#   update.sh --force   rebuild and restart anyway
#   update.sh --reset   the branch on GitHub was started again (its history replaced): make this folder match it.
#                       Anything changed by hand inside the checkout is lost; the players' data is outside it and is not touched.
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"                 # .../muay-manager/prototypes/fight3d
RUN_AS="${MUAY_USER:-$(stat -c %U "$APP")}"
BRANCH="${MUAY_BRANCH:-$(runuser -u "$RUN_AS" -- git -C "$APP" rev-parse --abbrev-ref HEAD)}"
as() { runuser -u "$RUN_AS" -- "$@"; }

cd "$APP"
as git fetch --quiet origin "$BRANCH"
NOW="$(as git rev-parse HEAD)"; NEW="$(as git rev-parse FETCH_HEAD)"
if [ "$NOW" = "$NEW" ] && [ -f dist/site/index.html ] && [ -z "${1:-}" ]; then exit 0; fi

if [ "$NOW" != "$NEW" ] && ! as git merge --ff-only --quiet FETCH_HEAD 2> /dev/null; then
  if [ "${1:-}" = "--reset" ]; then as git reset --hard --quiet FETCH_HEAD
  else echo "$(date -Is) the branch $BRANCH on GitHub no longer continues from this checkout. Run once: $0 --reset" >&2; exit 1; fi
fi
as npm ci --no-audit --no-fund --silent
# built to one side first: a build that fails leaves the running site as it was
as node build.mjs
systemctl restart muay-manager
sleep 2
if curl -fsS --max-time 5 "http://127.0.0.1:${PORT:-8787}/api/health" > /dev/null; then
  echo "$(date -Is) updated ${NOW:0:7} -> ${NEW:0:7}: $(cat dist/site/version.json)"
else
  echo "$(date -Is) updated to ${NEW:0:7} but the server does not answer: journalctl -u muay-manager -n 50" >&2; exit 1
fi
