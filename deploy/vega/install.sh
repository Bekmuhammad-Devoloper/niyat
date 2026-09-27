#!/usr/bin/env bash
# Niyat'ni Vega serveriga (62.171.184.14) o'rnatish — BIR MARTA, root sifatida.
#
#   ssh vega 'bash -s' < deploy/vega/install.sh
#
# Idempotent: qayta ishga tushirsa bo'ladi. Boshqa loyihalarga TEGMAYDI:
#   - pm2: faqat `niyat` jarayoni (port 2410)
#   - nginx: faqat sites-available/niyat (default_server YO'Q), reload (restart emas)
#   - systemd: faqat niyat-autodeploy.{service,timer}
# Oldindan: /opt/niyat/app clone qilingan, npm ci + npm run build o'tgan bo'lishi
# kerak (bo'lmasa shu skript o'zi qiladi).
set -euo pipefail
export HOME=/root PM2_HOME=/root/.pm2

REPO_URL="https://github.com/Bekmuhammad-Devoloper/niyat.git"
BRANCH="main"
BASE=/opt/niyat
APP=$BASE/app
STATE=$BASE/state
NODE22=$BASE/node/bin/node    # wrangler 4.x uchun Node >=22 (tizim node'i v20 — boshqa loyihalarniki)

log() { echo "==> $*"; }

mkdir -p "$BASE/logs" "$STATE"

# 1) Kod
if [ ! -d "$APP/.git" ]; then
  log "Clone $REPO_URL ($BRANCH)"
  git clone -q --depth=1 -b "$BRANCH" "$REPO_URL" "$APP"
fi
cd "$APP"
git fetch -q --depth=1 origin "$BRANCH" && git reset -q --hard "origin/$BRANCH"
log "Commit: $(git rev-parse --short HEAD)"

# 2) Server fayllari (repo ichidagi deploy/vega/ dan)
if [ ! -f deploy/vega/ecosystem.config.js ]; then
  echo "XATO: $APP/deploy/vega/ topilmadi — avval lokal o'zgarishlarni commit + push qiling (git push niyat main)." >&2
  exit 1
fi
cp deploy/vega/ecosystem.config.js deploy/vega/deploy.sh deploy/vega/autodeploy.sh deploy/vega/go-live.sh "$BASE/"
sed -i 's/\r$//' "$BASE"/*.sh "$BASE"/ecosystem.config.js
chmod +x "$BASE"/*.sh

# 2b) Node 22 — faqat /opt/niyat/node ichida, tizimga tegmaydi
if [ ! -x "$NODE22" ]; then
  TARBALL=$(curl -s -m 20 https://nodejs.org/dist/latest-v22.x/ | grep -oE 'node-v22[0-9.]+-linux-x64\.tar\.xz' | head -1)
  [ -n "$TARBALL" ] || TARBALL=node-v22.23.3-linux-x64.tar.xz
  log "Node 22 yuklanmoqda: $TARBALL"
  curl -sL -m 300 -o /tmp/$TARBALL "https://nodejs.org/dist/latest-v22.x/$TARBALL"
  rm -rf "$BASE/node.new" && mkdir -p "$BASE/node.new"
  tar -xJf /tmp/$TARBALL -C "$BASE/node.new" --strip-components=1
  rm -rf "$BASE/node" && mv "$BASE/node.new" "$BASE/node" && rm -f /tmp/$TARBALL
fi
log "Node (niyat): $("$NODE22" -v)"

# 3) Bog'liqliklar + build (agar hali yo'q bo'lsa)
if [ ! -d node_modules ]; then
  log "npm ci"
  npm ci --no-audit --no-fund
fi
sha256sum package-lock.json | cut -d' ' -f1 > "$BASE/.lockhash"
if [ ! -f dist/server/wrangler.json ]; then
  log "npm run build"
  npm run build | tail -3
fi

# 4) Secret'lar — .dev.vars (wrangler dev shuni o'qiydi). Yo'q bo'lsa shablon.
if [ ! -f .dev.vars ]; then
  cat > .dev.vars <<'VARS'
# Niyat secret'lari — wrangler dev shu fayldan o'qiydi. GCE'dagi .dev.vars dan ko'chiring.
OPENAI_API_KEY=
GEMINI_API_KEY=
ADMIN_PASSWORD=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@niyat.tech
VARS
  chmod 600 .dev.vars
  log "DIQQAT: $APP/.dev.vars bo'sh shablon — kalitlarni to'ldiring, keyin: pm2 restart niyat"
fi

# 5) D1 migratsiyalar (lokal SQLite: $STATE/v3/d1/)
log "D1 migratsiyalar"
"$NODE22" node_modules/wrangler/bin/wrangler.js d1 migrations apply niyat --local --persist-to "$STATE" 2>&1 | grep -E '✅|❌|Error' | tail -9 || true

# 6) pm2
if pm2 describe niyat >/dev/null 2>&1; then
  pm2 restart niyat --update-env >/dev/null
else
  pm2 start "$BASE/ecosystem.config.js" >/dev/null
fi
pm2 save >/dev/null 2>&1 || true
log "pm2: $(pm2 describe niyat 2>/dev/null | grep -E 'status' | head -1 | tr -s ' ')"

# 7) nginx — faqat niyat sayti
cp deploy/vega/nginx-niyat.conf /etc/nginx/sites-available/niyat
sed -i 's/\r$//' /etc/nginx/sites-available/niyat
ln -sf /etc/nginx/sites-available/niyat /etc/nginx/sites-enabled/niyat
# 7b) Landing (niyat.tech) — statik sahifa
mkdir -p "$BASE/landing" && cp -r "$APP/landing/." "$BASE/landing/"
cp deploy/vega/nginx-niyat-landing.conf /etc/nginx/sites-available/niyat-landing
sed -i 's/$//' /etc/nginx/sites-available/niyat-landing
ln -sf /etc/nginx/sites-available/niyat-landing /etc/nginx/sites-enabled/niyat-landing
nginx -t && systemctl reload nginx
log "nginx: niyat (my.niyat.tech -> :2410) va niyat-landing (niyat.tech) yoqildi"

# 8) Avtodeploy timer
cp deploy/vega/niyat-autodeploy.service deploy/vega/niyat-autodeploy.timer /etc/systemd/system/
sed -i 's/\r$//' /etc/systemd/system/niyat-autodeploy.service /etc/systemd/system/niyat-autodeploy.timer
systemctl daemon-reload
systemctl enable --now niyat-autodeploy.timer
log "timer: $(systemctl is-active niyat-autodeploy.timer)"

# 9) Sog'liq
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 8 http://127.0.0.1:2410/api/health || echo 000)
  [ "$code" = "200" ] && break
  sleep 4
done
log "health :2410 -> $code"
log "nginx  (Host: my.niyat.tech) -> $(curl -s -o /dev/null -w '%{http_code}' -m 8 -H 'Host: my.niyat.tech' http://127.0.0.1/api/health || echo 000)"
echo
echo "Keyingi qadamlar:"
echo "  1) $APP/.dev.vars ni to'ldiring (GCE: /home/bekmuhammad_devoloper/niyat/.dev.vars), keyin: pm2 restart niyat"
echo "  2) GCE D1 bazasini ko'chiring: .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite -> $STATE/v3/d1/miniflare-D1DatabaseObject/ (pm2 stop niyat; nusxalash; pm2 start niyat)"
echo "  3) DNS: my.niyat.tech, niyat.tech (@), www.niyat.tech A -> 62.171.184.14, keyin: bash $BASE/go-live.sh"
