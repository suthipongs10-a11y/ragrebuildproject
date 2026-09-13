#!/usr/bin/env bash
# Closes the gaps on a server that is already up and running. Run as root on the VPS:
#
#     bash harden.sh
#
# Safe to run again as often as you like - every step checks before it acts, and a
# machine that already has all four just gets four lines saying so.
#
# This exists because vps-setup.sh runs once, on an empty machine, and these four were
# either missing from it or missed by it. New machines get them from vps-setup.sh now;
# this is for the one that is already serving players.
#
# What it deliberately does NOT do: turn off ssh password logins. That is the single
# biggest thing left, and it is also the one that locks you out of your own server if
# the key is not right - which is not a thing to find out from a script running
# unattended. Ask for the key procedure separately; it needs two terminals and a
# test login before anything is switched off.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run this as root." >&2; exit 1; }

echo "==> Firewall"
if ! command -v ufw >/dev/null 2>&1; then
    echo "    ufw is not installed - skipping. (apt-get install -y ufw, then run this again)"
else
    ufw allow OpenSSH >/dev/null 2>&1 || true
    ufw allow 'Nginx Full' >/dev/null 2>&1 || true

    if ufw status | grep -q "Status: active"; then
        echo "    Already on."
    # Enabling is the one step here that can end this ssh session for good, so the ssh
    # rule is confirmed present in the list first. Checking that "ufw allow" returned
    # zero is not the same thing - it does that whether or not the rule took.
    elif ufw status | grep -Eq '(^|[[:space:]])(OpenSSH|22(/tcp)?)([[:space:]]|$)'; then
        ufw --force enable >/dev/null
        echo "    Turned on - ssh, http and https only."
    else
        echo "    LEFT OFF. No ssh rule is in the list, and turning the firewall on"
        echo "    now would lock you out of this machine. Add it by hand first:"
        echo "      ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable"
    fi
fi

echo "==> fail2ban"
if ! command -v fail2ban-client >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban >/dev/null
fi
systemctl enable --now fail2ban >/dev/null 2>&1 || true
if systemctl is-active --quiet fail2ban; then
    echo "    Watching ssh. Bans an address that keeps guessing."
else
    echo "    Did not start. See: systemctl status fail2ban"
fi

echo "==> Database backup"
# A cron line pointing at a script that is not there runs every six hours, fails every
# six hours, and mails root about it - while the thing it was added for, a copy of the
# characters, does not exist. Better to say so here.
if [ ! -x /opt/rorebuild/backup.sh ]; then
    echo "    /opt/rorebuild/backup.sh is missing - NOT adding the cron line."
    echo "    Put it there first:"
    echo "      install -m 755 -o rorebuild -g rorebuild deploy/backup.sh /opt/rorebuild/backup.sh"
elif crontab -l 2>/dev/null | grep -q rorebuild/backup.sh; then
    echo "    Already scheduled."
else
    # crontab -l exits 1 on a machine whose root has no crontab, which is every machine
    # the first time; under set -e that would kill the subshell before the echo, and the
    # line would never be written. It cost a run to find that out once already.
    ( crontab -l 2>/dev/null | grep -v rorebuild/backup.sh || true
      echo "0 */6 * * * /opt/rorebuild/backup.sh" ) | crontab -
    echo "    Every six hours, two weeks kept."
fi

echo "==> Security updates"
if [ -f /var/run/reboot-required ]; then
    echo "    A reboot is pending - the new kernel is installed but not running."
    echo "    Do it when nobody is online:   reboot"
else
    echo "    Nothing pending."
fi

echo
echo "Done. Still worth doing, by hand, when you have half an hour:"
echo "  ssh keys instead of a password. Ask for the procedure - it needs a second"
echo "  terminal kept open and a test login before password auth is switched off."
