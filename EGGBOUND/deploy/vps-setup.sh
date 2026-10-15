#!/usr/bin/env bash
# Eggbound on the VPS (2026-10-15) — run once as root on the server:
#   curl -fsSL https://raw.githubusercontent.com/suthipongs10-a11y/ragrebuildproject/claude/ecstatic-cray-ijhpj1/EGGBOUND/deploy/vps-setup.sh | sudo bash -s <public IP>
#
# What it does (safe to run again):
#   - nginx serves /var/www/eggbound on its own port (default 8080), so it never touches another site on 80/443
#     (deploy/ at the repo root puts the Ragnarok server there)
#   - user `eggbound` + an SSH key that can only rsync into /var/www/eggbound (rrsync) — GitHub Actions uploads
#     every build with it (.github/workflows/eggbound-vps.yml)
#   - opens the port in ufw when ufw is active
#   - prints ONE block to paste into the GitHub secret EGGBOUND_VPS (address, host key, private key)
set -euo pipefail

PORT="${PORT:-8080}"
WEB=/var/www/eggbound
USR=eggbound
IP="${1:-}"

[ "$(id -u)" = 0 ] || { echo "ต้องรันด้วย root: sudo bash $0 <IP>"; exit 1; }
if [ -z "$IP" ]; then IP="$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')"; fi

echo "==> ติดตั้ง nginx + rsync"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -q >/dev/null
apt-get install -y -q nginx rsync python3 >/dev/null

if ss -ltnH "sport = :$PORT" | grep -q . && ! grep -qs "listen $PORT;" /etc/nginx/sites-available/eggbound.conf; then
  echo "พอร์ต $PORT มีโปรแกรมอื่นใช้อยู่ — รันใหม่ด้วยพอร์ตอื่น เช่น: curl ... | sudo PORT=8090 bash -s $IP"; exit 1
fi

echo "==> ผู้ใช้ $USR + โฟลเดอร์ $WEB"
id -u "$USR" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$USR"
install -d -o "$USR" -g "$USR" -m 755 "$WEB"
if [ ! -f "$WEB/index.html" ]; then
  printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Eggbound</title><p style="font:16px sans-serif;padding:24px">Eggbound: เซิร์ฟเวอร์พร้อมแล้ว รอ GitHub Actions ส่งตัวเกมมา</p>\n' > "$WEB/index.html"
  chown "$USR:$USR" "$WEB/index.html"
fi

echo "==> nginx site (พอร์ต $PORT)"
V6=""; [ -s /proc/net/if_inet6 ] && V6="listen [::]:$PORT;"   # only when the machine has IPv6, or nginx refuses to start
cat > /etc/nginx/sites-available/eggbound.conf <<EOF
# Eggbound — static game page; uploads come from GitHub Actions via rsync (EGGBOUND/deploy/vps-setup.sh)
server {
    listen $PORT;
    $V6
    server_name _;
    root $WEB;
    index index.html;
    charset utf-8;

    gzip on;
    gzip_comp_level 5;
    gzip_types text/css application/javascript application/json image/svg+xml;

    add_header X-Content-Type-Options nosniff always;

    # the page changes with every build: always revalidate (ETag) so a new version shows on the next load
    location = /index.html { add_header Cache-Control "no-cache" always; add_header X-Content-Type-Options nosniff always; }
    location / { try_files \$uri \$uri/ =404; }
}
EOF
ln -sf /etc/nginx/sites-available/eggbound.conf /etc/nginx/sites-enabled/eggbound.conf
nginx -t
systemctl enable --now nginx >/dev/null 2>&1 || true
systemctl reload nginx

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo "==> เปิดพอร์ต $PORT ใน ufw"; ufw allow "$PORT/tcp" >/dev/null
fi

echo "==> กุญแจสำหรับ GitHub Actions (อัปโหลดได้เฉพาะ $WEB)"
SSHD="/home/$USR/.ssh"
install -d -o "$USR" -g "$USR" -m 700 "$SSHD"
KEY="$SSHD/github_actions"
[ -f "$KEY" ] || runuser -u "$USR" -- ssh-keygen -q -t ed25519 -N '' -C eggbound-github-actions -f "$KEY"
RR="$(command -v rrsync || true)"
LINE="restrict $(cat "$KEY.pub")"
[ -n "$RR" ] && LINE="command=\"$RR $WEB\",$LINE"
AK="$SSHD/authorized_keys"
touch "$AK"; grep -v "eggbound-github-actions" "$AK" > "$AK.tmp" || true
echo "$LINE" >> "$AK.tmp"; mv "$AK.tmp" "$AK"
chown "$USR:$USR" "$AK"; chmod 600 "$AK"
[ -n "$RR" ] || echo "!! ไม่พบ rrsync — กุญแจนี้ใช้ได้ทั้งบัญชี $USR (ยังจำกัดแค่ผู้ใช้นี้)"

SSHT="$(sshd -T 2>/dev/null || true)"
SSH_PORT="$(awk '/^port /{print $2; exit}' <<<"$SSHT")"; SSH_PORT="${SSH_PORT:-22}"
if grep -qiE '^(allowusers|allowgroups) ' <<<"$SSHT" && ! grep -qiE "^allowusers .*\b$USR\b" <<<"$SSHT"; then
  echo "!! sshd_config มี AllowUsers/AllowGroups — เพิ่ม $USR เข้าไปด้วย ไม่งั้น GitHub Actions เข้าไม่ได้"
fi
for t in ed25519 ecdsa rsa; do [ -f "/etc/ssh/ssh_host_${t}_key.pub" ] && { HOSTKEY="$(cut -d' ' -f1,2 "/etc/ssh/ssh_host_${t}_key.pub")"; break; }; done
if [ "$SSH_PORT" = 22 ]; then KH="$IP $HOSTKEY"; else KH="[$IP]:$SSH_PORT $HOSTKEY"; fi

cat <<EOF

============================================================================
เสร็จแล้ว — เกมจะอยู่ที่  http://$IP:$PORT/

ขั้นต่อไป: ก๊อปทุกบรรทัดระหว่างเส้น ----- ข้างล่าง (รวมบรรทัด BEGIN/END)
ไปใส่ใน GitHub → repo ragrebuildproject → Settings → Secrets and variables
→ Actions → New repository secret  ชื่อ  EGGBOUND_VPS
⚠️ อันนี้คือกุญแจลับ อย่าส่งในแชท อย่าแปะที่อื่น
----------------------------------------------------------------------------
url=http://$IP:$PORT/
$USR@$IP:$SSH_PORT
$KH
$(cat "$KEY")
----------------------------------------------------------------------------
EOF
