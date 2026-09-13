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
apt-get install -y "${APT_KEEP[@]}" nginx certbot python3-certbot-nginx sqlite3 unzip wget fail2ban

# Asked by runtime, not by whether a dotnet binary exists: a box with .NET 8 on it
# has the binary and still cannot run this server.
have_aspnet9() { dotnet --list-runtimes 2>/dev/null | grep -q "Microsoft.AspNetCore.App 9\."; }

# Three sources, tried in order, because which one has it depends on the release.
#
# On 22.04 the Microsoft feed carries the runtime and the first attempt is the end
# of it. On 24.04 it does not: that feed is published and updates cleanly, and holds
# no .NET 9 package at all - which apt reports as "Unable to locate package", the
# same words it uses for a typo. Ubuntu's own archives do not carry it either, in
# main, universe, updates or backports. So the ppa is tried next, and Microsoft's
# own installer last, which needs no archive and works anywhere.
if ! have_aspnet9; then
  . /etc/os-release
  wget -q "https://packages.microsoft.com/config/ubuntu/${VERSION_ID}/packages-microsoft-prod.deb" -O /tmp/packages-microsoft-prod.deb || true
  if [ -s /tmp/packages-microsoft-prod.deb ]; then dpkg -i /tmp/packages-microsoft-prod.deb || true; fi
  apt-get update || true
  apt-get install -y "${APT_KEEP[@]}" aspnetcore-runtime-9.0 || true
fi

if ! have_aspnet9; then
  echo "Not in this release's archives - trying the dotnet backports ppa."
  apt-get install -y "${APT_KEEP[@]}" software-properties-common || true
  add-apt-repository -y ppa:dotnet/backports || true
  apt-get update || true
  apt-get install -y "${APT_KEEP[@]}" aspnetcore-runtime-9.0 || true
fi

if ! have_aspnet9; then
  echo "Still not there - installing from Microsoft's own script instead of a package."
  wget -q https://dot.net/v1/dotnet-install.sh -O /tmp/dotnet-install.sh
  bash /tmp/dotnet-install.sh --channel 9.0 --runtime aspnetcore --install-dir /usr/share/dotnet --no-path
  ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet
fi

if ! have_aspnet9; then
  echo "Could not install the ASP.NET Core 9 runtime by any route. The server cannot start without it." >&2
  exit 1
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

# The firewall, switched on rather than merely configured.
#
# This used to add the two rules and stop, which does nothing at all: ufw ships
# disabled, and rules in a disabled firewall are a list nobody reads. It looked done
# from the output and from the script, and `ufw status` said inactive for weeks.
#
# Enabling is the step that can lock this session out of the machine, so it is done
# only after checking the ssh rule is really in the list - not after checking that the
# command to add it returned zero, which it also does when ufw is not managing ssh at
# all. If the rule is not there the firewall is left off, which is no worse than it was.
if command -v ufw >/dev/null 2>&1; then
  # Both the name and the number, because the two can disagree: OpenSSH is an
  # application profile, a file under /etc/ufw/applications.d, and a machine that does
  # not have it gets no rule from that line at all - while the line still succeeds.
  # Being wrong about this ends the session that is running it, so the port is opened
  # by number as well and the two back each other up.
  for rule in OpenSSH 22/tcp 'Nginx Full' 80/tcp 443/tcp; do
      ufw allow "$rule" >/dev/null 2>&1 || true
  done

  # `ufw status` lists nothing while ufw is disabled - it prints "Status: inactive" and
  # stops. So the old check here, which read `ufw status` for the ssh rule, could never
  # pass on the one machine it was written for: the one with the firewall still off. It
  # reported that it was leaving the firewall alone to avoid locking anyone out, which
  # read like caution and was a script that could not do its job. `ufw show added` is
  # the one that lists rules whether or not the firewall is running.
  have_ssh_rule() {
      { ufw show added 2>/dev/null; ufw status 2>/dev/null; } \
          | grep -Eq 'OpenSSH|(^|[[:space:]])22(/tcp)?([[:space:]]|$)'
  }

  if have_ssh_rule; then
    ufw --force enable >/dev/null
    echo "  Firewall on: ssh, http and https only."
  else
    echo "  LEAVING THE FIREWALL OFF - no ssh rule was found, and turning it on now"
    echo "  would end this session and lock you out. Add the rule by hand and enable it:"
    echo "    ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable"
  fi
fi

# Bans an address that keeps guessing the ssh password. Port 22 on a public address is
# probed around the clock by machines that do nothing else; this is the difference
# between a password that is eventually guessed and one that is not worth guessing at.
if command -v fail2ban-client >/dev/null 2>&1; then
  systemctl enable --now fail2ban >/dev/null 2>&1 || echo "  Could not start fail2ban - carrying on."
fi

# A database backup every six hours, two weeks kept.
#
# The "|| true" is the whole point of this comment. On a machine where root has no
# crontab yet - which is every machine this runs on, the first time - "crontab -l"
# exits 1, grep then reads nothing and exits 1 as well, and under "set -e" the
# subshell dies there, before the echo that adds the line. So the backup was never
# scheduled, and the script stopped on the spot: everything above it done,
# everything below it, including the message saying what to do next, never printed.
( crontab -u root -l 2>/dev/null | grep -v rorebuild/backup.sh || true
  echo "0 */6 * * * /opt/rorebuild/backup.sh" ) | crontab -u root -

cat <<EOM

Done. Next:
  1. unzip rorebuild-server.zip into /opt/rorebuild/server  (then: chown -R rorebuild:rorebuild /opt/rorebuild)
  2. systemctl start rorebuild    and watch:  journalctl -u rorebuild -f
  3. when a domain is registered and its DNS points here:
       bash domain-setup.sh <your-domain>
     which puts the front page up and gets the certificates. Until then the
     server answers on this machine's bare address over plain http.
EOM
