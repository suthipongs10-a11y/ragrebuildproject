#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04 / 24.04 VPS. Run as root, from the deploy/ folder:
#   bash vps-setup.sh play.example.com
# Installs the .NET 9 runtime, nginx and certbot, makes the rorebuild user and folders,
# installs the service and the nginx site. It does not start the game: unpack the server
# bundle first (docs/PHASE3-VPS.md).
set -euo pipefail

DOMAIN="${1:?usage: vps-setup.sh <domain>}"
HERE="$(cd "$(dirname "$0")" && pwd)"

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx sqlite3 unzip wget

if ! command -v dotnet >/dev/null 2>&1; then
  . /etc/os-release
  wget -q "https://packages.microsoft.com/config/ubuntu/${VERSION_ID}/packages-microsoft-prod.deb" -O /tmp/packages-microsoft-prod.deb
  dpkg -i /tmp/packages-microsoft-prod.deb
  apt-get update
  apt-get install -y aspnetcore-runtime-9.0
fi
dotnet --list-runtimes

id -u rorebuild >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/rorebuild --shell /usr/sbin/nologin rorebuild
mkdir -p /opt/rorebuild/server /opt/rorebuild/backup
install -m 755 "$HERE/backup.sh" /opt/rorebuild/backup.sh
chown -R rorebuild:rorebuild /opt/rorebuild

install -m 644 "$HERE/systemd/rorebuild.service" /etc/systemd/system/rorebuild.service
systemctl daemon-reload
systemctl enable rorebuild

sed "s/example.com/${DOMAIN}/g" "$HERE/nginx/rorebuild.conf" > /etc/nginx/sites-available/rorebuild.conf
ln -sf /etc/nginx/sites-available/rorebuild.conf /etc/nginx/sites-enabled/rorebuild.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null
  ufw allow 'Nginx Full' >/dev/null
fi

# a database backup every six hours, two weeks kept
( crontab -u root -l 2>/dev/null | grep -v rorebuild/backup.sh; echo "0 */6 * * * /opt/rorebuild/backup.sh" ) | crontab -u root -

cat <<EOM

Done. Next:
  1. unzip rorebuild-server.zip into /opt/rorebuild/server  (then: chown -R rorebuild:rorebuild /opt/rorebuild)
  2. systemctl start rorebuild    and watch:  journalctl -u rorebuild -f
  3. certbot --nginx -d ${DOMAIN}
EOM
