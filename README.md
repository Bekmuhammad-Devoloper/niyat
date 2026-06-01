# Niyat — AI hayot murabbiyi

Musulmon o'zbek yoshlari uchun AI hayot boshqaruvi ilovasi. Bu repository
loyihaning MVP 1 **web prototipi** — Flutter ilovasiga o'tishdan oldin UX/UI
ni validatsiya qilish va asosiy AI Murabbiy oqimini sinovdan o'tkazish uchun.

## Texnologiya

- **TanStack Start** (React 19, Vite, SSR) — Cloudflare Workers'da ishlaydi
- **TanStack Query** — server state va kesh
- **Tailwind v4 + shadcn/ui** — uslublar
- **Anthropic Claude API** (`claude-opus-4-7`) yoki **OpenAI** (`gpt-4o-mini`) — AI Murabbiy
- **Aladhan API** — namoz vaqtlari (Toshkent default)
- **localStorage** — niyat, vazifa, suhbat tarixi (F5'ga chidaydi)

## Boshlash

```bash
npm install
cp .env.example .env
# .env ichida ANTHROPIC_API_KEY=sk-ant-... YOKI OPENAI_API_KEY=sk-... ni qo'ying
npm run dev
```

So'ng http://localhost:8080 ni oching.

Hech qaysi kalit yo'q bo'lsa, AI Murabbiy **demo rejim**da ishlaydi
(mock javoblar). Kalit qo'shilgandan keyin Coach header'ida ✨ belgisi
chiqadi — bu real AI ishlayotganini bildiradi.

### AI provayder tanlash

| Provider | Kalit formati | Model | Qaerdan olish |
|---|---|---|---|
| **Anthropic Claude** (tavsiya) | `sk-ant-api03-...` | `claude-opus-4-7` | https://console.anthropic.com |
| **OpenAI** (muqobil) | `sk-proj-...` yoki `sk-...` | `gpt-4o-mini` | https://platform.openai.com/api-keys |

Ikkalasi ham `.env`'da bo'lsa, **Anthropic** ustunlik beradi (loyiha
vision'iga mos: Claude'ning system prompt caching va adaptive thinking
muvozanati bu use-case uchun yaxshiroq). OpenAI'ga o'tish uchun
`ANTHROPIC_API_KEY` qatorini izohlang yoki o'chiring.

⚠️ **API kalitni hech kim bilan ulashmang.** Kalit ham brauzer, ham
chat'ga ko'rinmasligi kerak — faqat lokal `.env` faylda.

## Skriptlar

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Vite dev server (HMR, port 8080) |
| `npm run build` | Production build (client + SSR) |
| `npm run preview` | Production build'ni mahalliy sinab ko'rish |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Cloudflare Workers'ga deploy

Loyiha Cloudflare Workers'da ishlash uchun mo'ljallangan
(`wrangler.jsonc` mavjud).

```bash
npm run build
npx wrangler secret put ANTHROPIC_API_KEY  # API kalitini qo'shing
npx wrangler deploy
```

## Loyiha tuzilishi

```
src/
├── components/niyat/        # MVP UI komponentlari
│   ├── NiyatApp.tsx         # Asosiy ilova (tab orchestratsiya)
│   ├── Onboarding.tsx       # Birinchi kirish (ism + niyat)
│   ├── screens/             # 5 ta asosiy ekran
│   ├── PhoneFrame.tsx       # iPhone ramkasi
│   ├── StatusBar.tsx        # Yuqori panel (soat)
│   └── TabBar.tsx           # Pastki navigatsiya
├── lib/
│   ├── api/
│   │   ├── aladhan.ts                 # Namoz vaqtlari API
│   │   ├── coach-handler.ts           # Claude API server handler
│   │   └── coach-system-prompt.ts     # Niyat AI shaxsiyati
│   ├── hooks/
│   │   ├── use-coach.ts               # Coach mutation hook
│   │   ├── use-prayer-times.ts        # Namoz vaqtlari query
│   │   └── use-user-profile.ts        # Foydalanuvchi profili
│   ├── niyat-data.ts                  # Markazlashgan mock data
│   └── use-local-state.ts             # SSR-safe localStorage hook
├── routes/                  # TanStack Router fayllari
├── server.ts                # Cloudflare Workers entry + /api/coach
├── start.ts                 # TanStack Start setup
└── styles.css               # Tailwind + custom CSS
```

## AI Murabbiy arxitekturasi

```
Client (CoachScreen)
    ↓ POST /api/coach { messages, userContext }
    ↓
Server (server.ts on Workers, OR Vite dev middleware)
    ↓
coach-handler.ts
    ↓ Anthropic SDK
    ↓
Claude API (claude-opus-4-7)
    + system prompt with cache_control
    + adaptive thinking
    + effort: medium
    ↓
Reply → client
```

System prompt (`coach-system-prompt.ts`) prompt caching bilan keladi —
har turn'da aynan bir xil bo'lgani uchun cache hit ~80%dan yuqori.
Tannarx oshmaydi.

API kaliti **clientga sirib chiqmaydi**. Faqat server-side handler ko'radi.

## Sinov

Coach screen'da quyidagi savollarni sinab ko'ring:

- "Bomdoddan keyin nima qilay?"
- "Onamga qo'ng'iroq qildimmi kechqurun?"
- "Instagram ochib qoldim, qanday to'xtataman?"
- "Bugungi niyatim haqida fikrla"

Niyat ekranida niyatni yangilang — keyin Coach unga e'tibor beradi.

## Loyiha hujjati

To'liq vision va MVP rejasi: `../loyiha-hayot-murabbiyi.md`
