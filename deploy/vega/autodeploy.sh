#!/usr/bin/env bash
# Niyat avtodeploy - TORTIB OLUVCHI (pull) usul. /opt/niyat/autodeploy.sh
#
# Har daqiqada (niyat-autodeploy.timer) `git ls-remote` bilan `main` boshini
# tekshiradi. Farq bo'lsa - GitHub'dagi `check` job (tsc + build) o'tganini
# kutadi va shundan keyingina deploy qiladi. `check` umuman bo'lmasa (masalan
# faqat .md o'zgargan) 5 daqiqadan keyin baribir deploy qiladi.
set -u
export HOME="${HOME:-/root}"
export PM2_HOME="${PM2_HOME:-/root/.pm2}"
REPO="Bekmuhammad-Devoloper/niyat"
BRANCH="main"
APP="/opt/niyat/app"
LOG="/opt/niyat/autodeploy.log"

log() { echo "$(date '+%F %T') | $*" >> "$LOG"; }

cd "$APP" 2>/dev/null || { log "app papkasi yo'q"; exit 0; }

LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git ls-remote origin "refs/heads/$BRANCH" 2>/dev/null | cut -f1)
[ -n "$REMOTE" ] || { log "ls-remote javob bermadi"; exit 0; }
[ "$LOCAL" = "$REMOTE" ] && exit 0

STATE=$(curl -s -m 25 "https://api.github.com/repos/$REPO/commits/$REMOTE/check-runs" \
  | python3 -c "
import sys, json
try: runs = json.load(sys.stdin).get('check_runs', [])
except Exception: print('API_XATO'); raise SystemExit
chk = [r for r in runs if r['name'] == 'check']
if not chk: print('YOQ')
elif any(r['status'] != 'completed' for r in chk): print('KETYAPTI')
elif all(r['conclusion'] == 'success' for r in chk): print('OK')
else: print('YIQILDI')
" 2>/dev/null)

git fetch --depth=1 -q origin "$BRANCH" 2>/dev/null
AGE=$(( $(date +%s) - $(git log -1 --format=%ct FETCH_HEAD 2>/dev/null || date +%s) ))

case "$STATE" in
  OK)        log "yangi commit ${REMOTE:0:7} - check o'tdi, deploy boshlandi" ;;
  KETYAPTI)  exit 0 ;;
  YIQILDI)   log "commit ${REMOTE:0:7} - check YIQILDI, deploy QILINMAYDI"; exit 0 ;;
  YOQ)       if [ "$AGE" -gt 300 ]; then
               log "commit ${REMOTE:0:7} - check yo'q, ${AGE}s kutildi, deploy"
             else
               exit 0
             fi ;;
  *)         log "commit ${REMOTE:0:7} - check holati aniqlanmadi ($STATE), kutamiz"; exit 0 ;;
esac

if bash /opt/niyat/deploy.sh "$BRANCH" >> "$LOG" 2>&1; then
  NEW=$(git -C "$APP" rev-parse --short HEAD)
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:2410/api/health || echo 000)
    [ "$code" = "200" ] && { log "deploy TUGADI: $NEW (sog'liq $code)"; exit 0; }
    sleep 5
  done
  log "deploy tugadi ($NEW) lekin SOG'LIQ TEKSHIRUVI O'TMADI"
else
  log "deploy YIQILDI (yuqoridagi jurnalga qarang)"
fi
