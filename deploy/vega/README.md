# Niyat — Vega serveriga (62.171.184.14) ko'chirish

Server ko'p loyihali (marja-*, vega-*, hizmat24, ...). Niyat faqat o'z nomi
bilan ishlaydi: pm2 `niyat`, port `2410`, `/opt/niyat/`, nginx sayti `niyat`,
timer `niyat-autodeploy`.

## Arxitektura serverda

| Narsa | Qayerda |
|---|---|
| Kod | `/opt/niyat/app` (GitHub `Bekmuhammad-Devoloper/niyat`, `main`) |
| Jarayon | pm2 `niyat` → `wrangler dev` (workerd + lokal D1), 127.0.0.1:2410 |
| Ma'lumotlar (D1 SQLite) | `/opt/niyat/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite` |
| Secret'lar | `/opt/niyat/app/.dev.vars` (wrangler shuni o'qiydi) |
| nginx | `/etc/nginx/sites-available/niyat` — `my.niyat.tech` → :2410 |
| Avtodeploy | `niyat-autodeploy.timer` har daqiqada `main`ni tekshiradi, `check` job o'tsa deploy |
| Loglar | `pm2 logs niyat`, `/opt/niyat/autodeploy.log` |
| Landing | `/opt/niyat/landing` (repo `landing/`), nginx `niyat-landing` — `niyat.tech`, `/apk` → GitHub Release `niyat.apk` |

## Bir martalik o'rnatish

```bash
# 1) Lokal: o'zgarishlarni GitHub'ga chiqaring (install.sh repo'dagi deploy/vega/ ni ishlatadi)
git push niyat main

# 2) Serverda o'rnatish (root)
ssh vega 'bash -s' < deploy/vega/install.sh

# 3) Secret'larni GCE'dan ko'chiring (OPENAI, GEMINI, ADMIN_PASSWORD, VAPID_*)
#    GCE: /home/bekmuhammad_devoloper/niyat/.dev.vars  ->  vega: /opt/niyat/app/.dev.vars
ssh vega 'pm2 restart niyat'

# 4) Ma'lumotlar bazasini ko'chiring (foydalanuvchilar, sessiyalar, e'lonlar, push obunalar)
#    GCE: /home/bekmuhammad_devoloper/niyat/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/
#    vega: /opt/niyat/state/v3/d1/miniflare-D1DatabaseObject/
#    (pm2 stop niyat; *.sqlite* fayllarini nusxalash; pm2 start niyat)
#    Fayl nomi (database_id hash'i) ikkala serverda bir xil: a36f84ea...b6006.sqlite

# 5) DNS: my.niyat.tech  A  ->  62.171.184.14   (APK shu domenga qurilgan — o'zgartirmang)
#    So'ng SSL:
ssh vega 'bash /opt/niyat/go-live.sh'

# 6) Eski GCE deploy'ni o'chiring: .github/workflows/deploy.yml (GCE'ga SSH qiladi)
```

## Kundalik ish

```bash
git push niyat main                       # ~1-2 daqiqada serverga tushadi
ssh vega 'tail -20 /opt/niyat/autodeploy.log'
ssh vega 'pm2 logs niyat --lines 50 --nostream --no-color'
ssh vega 'curl -s http://127.0.0.1:2410/api/health'
ssh vega 'bash /opt/niyat/deploy.sh main'    # qo'lda deploy
```

## Taqiqlar (boshqa loyihalar uchun)

`pm2 kill`, `pm2 delete all`, `docker system prune`, `systemctl restart nginx`,
nginx'da `default_server` — ISHLATILMAYDI. Faqat `pm2 restart niyat`,
`nginx -t && systemctl reload nginx`.
