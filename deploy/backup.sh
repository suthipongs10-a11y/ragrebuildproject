#!/usr/bin/env bash
# Backs up the SQLite database while the server is running. sqlite3's .backup takes a
# consistent copy even mid-write, which a plain cp of a WAL database does not.
set -euo pipefail

SRC=/opt/rorebuild/server/RoCharacterDatabase.db
DST=/opt/rorebuild/backup
KEEP_DAYS=14

[ -f "$SRC" ] || { echo "no database at $SRC"; exit 0; }
mkdir -p "$DST"
STAMP=$(date +%Y%m%d-%H%M)
sqlite3 "$SRC" ".backup '$DST/RoCharacterDatabase-$STAMP.db'"
gzip -f "$DST/RoCharacterDatabase-$STAMP.db"
find "$DST" -name 'RoCharacterDatabase-*.db.gz' -mtime +"$KEEP_DAYS" -delete
echo "backed up to $DST/RoCharacterDatabase-$STAMP.db.gz"
