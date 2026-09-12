#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 22.04 / 24.04 VPS. Run as root, from the deploy/ folder:
#   bash vps-setup.sh play.example.com
# Installs the .NET 9 runtime, nginx and certbot, makes the rorebuild user and folders,
# installs the service and the nginx site. It does not start the game: unpack the server
# bundle first (docs/PHASE3-VPS.md).
set -euo pipefail

DOMAIN="${1:?usage: vps-setup.sh <domain>}"
HERE="$(cd "$(dirname "$0")" && pwd)"

# No package may stop to ask a question. This is meant to be started and left, and
# on 24.04 apt has two habits that break that: debconf draws a notice about the
# pending kernel, and needrestart asks which services to restart. Both open
# /dev/tty directly, so they appear on screen even with output redirected to a
# file - and if this was started in the background, reading that terminal earns a
# SIGTTIN and the whole run stops dead behind a dialog that will not take a
# keypress, looking for all the world like a hang.
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1

apt-get update
APT_KEEP=(-o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
apt-get install -y "${APT_KEEP[@]}" nginx certbot python3-certbot-nginx sqlite3 unzip wget

if ! command -v dotnet >/dev/null 2>&1; then
  . /etc/os-release
  wget -q "https://packages.microsoft.com/config/ubuntu/${VERSION_ID}/packages-microsoft-prod.deb" -O /tmp/packages-microsoft-prod.deb
  dpkg -i /tmp/packages-microsoft-prod.deb
  apt-get update
  apt-get install -y "${APT_KEEP[@]}" aspnetcore-runtime-9.0
fi
dotnet --list-runtimes

id -u rorebuild >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/rorebuild --shell /usr/sbin/nologin rorebuild
mkdir -p /opt/rorebuild/server /opt/rorebuild/backup
# Carriage returns are stripped on the way in rather than trusted to be absent.
# .gitattributes keeps them out of a checkout, but these files also get copied by
# hand, and a stray \r in the service file means the server silently starts with
# the developer settings instead of the live ones.
sed 's/\r$//' "$HERE/backup.sh" > /opt/rorebuild/backup.sh
chmod 755 /opt/rorebuild/backup.sh
chown -R rorebuild:rorebuild /opt/rorebuild

sed 's/\r$//' "$HERE/systemd/rorebuild.service" > /etc/systemd/system/rorebuild.service
chmod 644 /etc/systemd/system/rorebuild.service
systemctl daemon-reload
systemctl enable rorebuild

sed -e 's/\r$//' -e "s/example.com/${DOMAIN}/g" "$HERE/nginx/rorebuild.conf" > /etc/nginx/sites-available/rorebuild.conf
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
