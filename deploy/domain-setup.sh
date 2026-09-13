#!/usr/bin/env bash
# Points a registered domain at this server and puts the front page up. Run as root on
# the VPS, after the domain is registered and its DNS records are in:
#
#     bash domain-setup.sh example.com
#
# What it expects to find at the registrar, all three pointing at this machine:
#
#     A     @      <this server's IP>
#     A     www    <this server's IP>
#     A     play   <this server's IP>
#
# After it runs:
#     example.com        the front page - what the server is and whether it is up
#     www.example.com    the same
#     play.example.com   the game
#
# Safe to run again. Run it again after changing the front page, after moving the
# server to a new address, or if certbot was skipped the first time because DNS had
# not caught up yet.
set -euo pipefail

DOMAIN="${1:?usage: domain-setup.sh <domain>   (for example: domain-setup.sh example.com)}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB=/opt/rorebuild/web

# A bare name, no scheme and no path: everything below builds www. and play. on top of
# it, and "https://example.com/" would turn into "play.https://example.com/".
if ! printf '%s' "$DOMAIN" | grep -Eq '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'; then
    echo "That does not look like a bare domain: $DOMAIN" >&2
    echo "Pass it with no https:// and no trailing slash, e.g. domain-setup.sh example.com" >&2
    exit 1
fi

if printf '%s' "$DOMAIN" | grep -Eq '^(www|play)\.'; then
    echo "Pass the bare domain, not $DOMAIN - www. and play. are added for you." >&2
    exit 1
fi

echo "==> Front page"
mkdir -p "$WEB"
sed 's/\r$//' "$HERE/web/index.html" > "$WEB/index.html"
# nginx reads these as www-data, which is neither the owner nor in the group, so the
# world bit is the one that matters. /opt/rorebuild is chowned to the game's user by
# install-bundle.sh and that is fine - it only ever has to be readable from here.
chmod 755 "$WEB"
chmod 644 "$WEB/index.html"
echo "    $WEB/index.html"

echo "==> nginx"
sed -e 's/\r$//' -e "s/example\.com/${DOMAIN}/g" "$HERE/nginx/rorebuild.conf" \
    > /etc/nginx/sites-available/rorebuild.conf
ln -sf /etc/nginx/sites-available/rorebuild.conf /etc/nginx/sites-enabled/rorebuild.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
echo "    ${DOMAIN}, www.${DOMAIN} -> the front page"
echo "    play.${DOMAIN}           -> the game"

# --------------------------------------------------------------------------------
# Certificates, but only once the names actually arrive here.
#
# certbot proves ownership by having Let's Encrypt fetch a file over the name being
# asked for. Until DNS has caught up that fetch lands somewhere else, or nowhere, and
# the attempt fails - and failed attempts are counted: five for the same set of names
# in an hour and the whole set is locked out for the rest of it. Waiting for the
# records to resolve costs minutes; being rate limited costs an hour.
# --------------------------------------------------------------------------------
echo "==> DNS"
MYIP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)"
if [ -z "$MYIP" ]; then
    MYIP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    echo "    Could not ask the internet what this server's address is; going by the"
    echo "    local one, $MYIP. If this machine is behind NAT that is the wrong answer."
fi
echo "    This server: $MYIP"

READY=1
for name in "$DOMAIN" "www.$DOMAIN" "play.$DOMAIN"; do
    got="$(getent ahostsv4 "$name" 2>/dev/null | awk '{print $1; exit}')"
    if [ -z "$got" ]; then
        echo "    $name -> (does not resolve yet)"
        READY=0
    elif [ "$got" != "$MYIP" ]; then
        echo "    $name -> $got   (not this server)"
        READY=0
    else
        echo "    $name -> $got   ok"
    fi
done

if [ "$READY" -eq 1 ]; then
    echo "==> Certificates"
    certbot --nginx --non-interactive --agree-tos --redirect \
        -d "$DOMAIN" -d "www.$DOMAIN" -d "play.$DOMAIN" \
        --register-unsafely-without-email
    systemctl reload nginx
    echo
    echo "Done. https://${DOMAIN}/ is the front page, https://play.${DOMAIN}/ is the game."
else
    echo
    echo "The site is up over plain http, but certificates were SKIPPED because not every"
    echo "name points here yet. DNS usually takes a few minutes and can take a few hours."
    echo
    echo "Check again with:   bash $0 $DOMAIN"
    echo "It will pick up where it left off and ask for the certificates then."
    echo
    echo "Until then: http://${DOMAIN}/ and http://play.${DOMAIN}/"
fi
