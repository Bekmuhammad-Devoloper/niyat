#!/usr/bin/env bash
# DNS 62.171.184.14 ga ko'chgandan keyin ishga tushiring:
#     bash /opt/niyat/go-live.sh
# Har domen ANIQ shu serverga ishora qilsagina certbot chaqiriladi.
# Boshqa loyihalarning sertifikatlariga TEGMAYDI.
set -u
IP="$(curl -s -m 10 https://api.ipify.org || echo 62.171.184.14)"
EMAIL="${CERT_EMAIL:-khamidovonline@gmail.com}"
# my.niyat.tech — ilova (alohida sertifikat); niyat.tech + www — landing (bitta sertifikat)
GROUPS_LIST="my.niyat.tech niyat.tech,www.niyat.tech"

resolves() {
  local got
  got="$(dig +short +time=3 +tries=2 @8.8.8.8 "$1" A | tail -1)"
  [ -n "$got" ] || got="$(dig +short +time=3 +tries=2 @1.1.1.1 "$1" A | tail -1)"
  echo "  $1 -> ${got:--}"
  [ "$got" = "$IP" ]
}

echo "Server IP : $IP"
for group in $GROUPS_LIST; do
  ARGS=""
  for d in ${group//,/ }; do
    if resolves "$d"; then ARGS="$ARGS -d $d"; fi
  done
  if [ -z "$ARGS" ]; then
    echo "  ($group) hali bu serverga ishora qilmayapti - DNS A yozuvini $IP ga o'zgartiring."
    continue
  fi
  echo "certbot: $ARGS"
  certbot --nginx $ARGS --non-interactive --agree-tos -m "$EMAIL" --redirect --expand --keep-until-expiring
  echo "certbot exit=$?"
done
nginx -t && systemctl reload nginx && echo "nginx qayta yuklandi"
for d in my.niyat.tech niyat.tech; do
  echo "$d: $(curl -s -o /dev/null -w '%{http_code}' -m 10 "https://$d/" || echo 000)"
done
