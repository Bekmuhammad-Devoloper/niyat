#!/usr/bin/env bash
# DNS my.niyat.tech -> 62.171.184.14 ga ko'chgandan keyin ishga tushiring:
#     bash /opt/niyat/go-live.sh
# Faqat my.niyat.tech shu serverga ishora qilsa certbot chaqiriladi.
# Boshqa loyihalarning sertifikatlariga TEGMAYDI.
set -u
IP="$(curl -s -m 10 https://api.ipify.org || echo 62.171.184.14)"
EMAIL="${CERT_EMAIL:-khamidovonline@gmail.com}"
DOMAIN="my.niyat.tech"

got="$(dig +short +time=3 +tries=2 @8.8.8.8 "$DOMAIN" A | tail -1)"
[ -n "$got" ] || got="$(dig +short +time=3 +tries=2 @1.1.1.1 "$DOMAIN" A | tail -1)"
echo "Server IP : $IP"
echo "$DOMAIN  : ${got:--}"
if [ "$got" != "$IP" ]; then
  echo "Domen hali bu serverga ishora qilmayapti - DNS A yozuvini $IP ga o'zgartiring."
  exit 0
fi
echo "certbot ishga tushmoqda..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect --keep-until-expiring
echo "certbot exit=$?"
nginx -t && systemctl reload nginx && echo "nginx qayta yuklandi"
curl -sI -m 10 "https://$DOMAIN/api/health" | head -1
