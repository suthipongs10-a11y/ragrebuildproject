#!/usr/bin/env bash
# Work on Eggbound directly on the VPS (2026-10-15) — the owner's GitHub account is blocked, so the project moves onto
# the server: a clone in /home/eggbound/ragrebuildproject, Node 22 + Pillow (AVIF) to build it, Claude Code to work on
# it, and publish.sh to put a build live on nginx (/var/www/eggbound, set up by vps-setup.sh — run that first).
# Run once as root (safe to run again):
#   curl -fsSL https://raw.githubusercontent.com/suthipongs10-a11y/ragrebuildproject/claude/ecstatic-cray-ijhpj1/EGGBOUND/deploy/vps-dev-setup.sh | sudo bash
set -euo pipefail

USR=eggbound
HOMED="/home/$USR"
REPO="$HOMED/ragrebuildproject"
BRANCH="claude/ecstatic-cray-ijhpj1"
URL="${REPO_URL:-https://github.com/suthipongs10-a11y/ragrebuildproject.git}"
as() { runuser -u "$USR" -- "$@"; }
login() { runuser -l "$USR" -c "$1"; }

[ "$(id -u)" = 0 ] || { echo "ต้องรันด้วย root"; exit 1; }
id -u "$USR" >/dev/null 2>&1 && [ -d /var/www/eggbound ] || { echo "รัน vps-setup.sh ก่อน (สร้างผู้ใช้ $USR + nginx)"; exit 1; }

echo "==> เครื่องมือพื้นฐาน"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -q >/dev/null
apt-get install -y -q git curl ca-certificates python3-venv rsync tmux >/dev/null

if ! node -v 2>/dev/null | grep -qE '^v(2[2-9]|[3-9][0-9])\.'; then
  echo "==> Node 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -q nodejs >/dev/null
fi
echo "    node $(node -v)"

echo "==> Python + Pillow (แปลงรูปเป็น AVIF ตอน build)"
[ -x "$HOMED/.venv/bin/python3" ] || as python3 -m venv "$HOMED/.venv"
as "$HOMED/.venv/bin/pip" install -q --upgrade pip >/dev/null
as "$HOMED/.venv/bin/pip" install -q pillow==12.3.0
as "$HOMED/.venv/bin/python3" -I -c "from PIL import features; assert features.check('avif')"
# login shells (su - eggbound, runuser -l) find the venv python first, so build.mjs's `python3` has AVIF
grep -qs 'eggbound-dev' "$HOMED/.profile" || cat >> "$HOMED/.profile" <<'EOP'
# eggbound-dev: venv python (Pillow with AVIF) and Claude Code first on PATH
export PATH="$HOME/.venv/bin:$HOME/.local/bin:$PATH"
EOP

echo "==> โค้ดเกม ($BRANCH)"
if [ ! -d "$REPO/.git" ]; then
  as git clone --branch "$BRANCH" "$URL" "$REPO"
else
  as git -C "$REPO" pull --ff-only || echo "    (pull ไม่ได้ — ใช้โค้ดที่มีอยู่)"
fi
as git -C "$REPO" config user.name "Eggbound VPS"
as git -C "$REPO" config user.email "eggbound@vps.local"

echo "==> build รอบแรก + ขึ้นเว็บ (รอบแรกแปลงรูปนาน ~5 นาที)"
login "cd '$REPO/EGGBOUND/game' && npm ci --no-audit --no-fund && bash ../deploy/publish.sh --quick"

echo "==> Claude Code"
if ! login 'command -v claude' >/dev/null 2>&1; then
  login 'curl -fsSL https://claude.ai/install.sh | bash' || true
fi
if ! login 'command -v claude' >/dev/null 2>&1; then
  npm install -g @anthropic-ai/claude-code >/dev/null
fi
echo "    $(login 'claude --version' 2>/dev/null || echo 'ติดตั้งไม่สำเร็จ')"

cat <<EOF

============================================================================
พร้อมทำงานบน VPS แล้ว
  เข้าทำงาน:   tmux new -s egg            (ปิดหน้าต่าง SSH แล้ว Claude ยังทำงานต่อ · กลับมา: tmux attach -t egg)
               su - $USR
               cd ragrebuildproject/EGGBOUND
               claude                     (ครั้งแรก: เปิดลิงก์ล็อกอินบัญชี Claude แล้ว /exit)
               claude remote-control      (แชทนี้ไปโผล่ในแอป Claude Code บนมือถือ/เว็บ)
  ขึ้นเว็บเอง:  bash deploy/publish.sh
============================================================================
EOF
