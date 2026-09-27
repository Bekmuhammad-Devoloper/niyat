// Niyat — pm2 jarayoni (Vega serveri, ko'p loyihali).
//
// DIQQAT: bu serverda boshqa loyihalarning pm2 jarayonlari ham bor
// (marja-*, vega-*). Shu bois:
//   • har doim `pm2 start /opt/niyat/ecosystem.config.js` — faqat shu ro'yxat;
//   • HECH QACHON `pm2 delete all` / `pm2 kill` ishlatilmaydi;
//   • nom `niyat`, port 2410 (bandligi tekshirilgan, 2400-2404 vega'niki).
//
// Ilova Cloudflare Workers uchun yozilgan (TanStack Start + D1). Serverda
// `wrangler dev` orqali workerd ichida ishlaydi — D1 lokal SQLite sifatida
// /opt/niyat/state/v3/d1/ ichida saqlanadi. Secret'lar /opt/niyat/app/.dev.vars
// faylidan o'qiladi (wrangler.jsonc yonida).
module.exports = {
  apps: [
    {
      name: 'niyat',
      cwd: '/opt/niyat/app',
      script: 'node_modules/wrangler/bin/wrangler.js',
      args: 'dev --config dist/server/wrangler.json --port 2410 --ip 127.0.0.1 --persist-to /opt/niyat/state --show-interactive-dev-session=false',
      interpreter: 'node',
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      kill_timeout: 8000,
      env: {
        NODE_ENV: 'production',
        HOME: '/root',
        CI: 'true',
        WRANGLER_SEND_METRICS: 'false',
      },
      out_file: '/opt/niyat/logs/out.log',
      error_file: '/opt/niyat/logs/err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
