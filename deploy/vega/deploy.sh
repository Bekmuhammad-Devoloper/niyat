#!/usr/bin/env bash
# SERVERDA turadi: /opt/niyat/deploy.sh
# Chaqirish:  bash /opt/niyat/deploy.sh main
#
# Repo PUBLIC — server to'g'ridan-to'g'ri GitHub'dan tortadi, kalit kerak emas.
# .dev.vars, node_modules, /opt/niyat/state kuzatilmagan -> git tegmaydi.
set -euo pipefail

BRANCH="${1:-main}"
APP_DIR="${APP_DIR:-/opt/niyat/app}"
STATE_DIR="${STATE_DIR:-/opt/niyat/state}"
PM2_APP="${PM2_APP:-niyat}"
export HOME="${HOME:-/root}"
export PM2_HOME="${PM2_HOME:-/root/.pm2}"

log() { echo "--> $*"; }

cd "$APP_DIR"

log "Kod tortilmoqda ($BRANCH)"
git fetch --depth=1 origin "$BRANCH"
OLD_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "yo'q")
git reset --hard "origin/$BRANCH"
NEW_SHA=$(git rev-parse --short HEAD)
log "  $OLD_SHA -> $NEW_SHA"

# Bog'liqliklar FAQAT package-lock.json o'zgargandagina qayta o'rnatiladi
# (npm ci node_modules'ni butunlay qayta yozadi — ishlab turgan jarayonga
# xavfli, shuning uchun avval to'xtatamiz).
LOCK_HASH_FILE="/opt/niyat/.lockhash"
NEW_LOCK=$(sha256sum package-lock.json | cut -d' ' -f1)
OLD_LOCK=$(cat "$LOCK_HASH_FILE" 2>/dev/null || echo "")
NEEDS_INSTALL=0
[ -d node_modules ] || NEEDS_INSTALL=1
[ "$NEW_LOCK" != "$OLD_LOCK" ] && NEEDS_INSTALL=1

if [ "$NEEDS_INSTALL" = "1" ]; then
  log "Bog'liqliklar o'zgargan — jarayon to'xtatilib qayta o'rnatiladi"
  pm2 stop "$PM2_APP" >/dev/null 2>&1 || true
  npm ci --no-audit --no-fund
  printf '%s' "$NEW_LOCK" > "$LOCK_HASH_FILE"
else
  log "Bog'liqliklar o'zgarmagan — o'rnatish o'tkazib yuborildi"
fi

log "Build (vite: client + worker) — ~30-60s uzilish bo'ladi"
# Vite dist/ ni tozalab qayta yozadi; wrangler shu paytda eski faylni
# topolmay qolmasin deb avval to'xtatamiz.
pm2 stop "$PM2_APP" >/dev/null 2>&1 || true
npm run build >/tmp/niyat-build.log 2>&1 || { tail -30 /tmp/niyat-build.log; exit 1; }
grep -E "built in" /tmp/niyat-build.log | tail -2

log "D1 migratsiyalar (lokal SQLite: $STATE_DIR)"
node node_modules/wrangler/bin/wrangler.js d1 migrations apply niyat --local --persist-to "$STATE_DIR" 2>&1 | grep -vE '^\s*$' | tail -4

log "pm2 ishga tushirish"
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env >/dev/null
else
  pm2 start /opt/niyat/ecosystem.config.js >/dev/null
fi
pm2 save >/dev/null 2>&1 || true
log "Tayyor: $NEW_SHA"
