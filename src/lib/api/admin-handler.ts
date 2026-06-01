// Backend admin — D1 ma'lumotlar bazasi bilan ishlash.
// Auth: header X-Admin-Password admin paroliga teng bo'lishi kerak.
//
// Endpoints:
//   GET  /api/admin/stats     — umumiy statistika
//   GET  /api/admin/users     — foydalanuvchilar ro'yxati
//   POST /api/admin/users/:id/premium — Premium o'zgartirish

import type { D1Database, UserRow } from "../db/types";
import { rowToPublicUser } from "../db/types";
import { handleSendPushToAll } from "./push-handler";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

// Dev/MVP default — production'da ADMIN_PASSWORD secret o'rnatilishi shart.
const DEV_ADMIN_PASSWORD_FALLBACK = "yuksalish2026";

function requireAdmin(request: Request, adminPassword: string | undefined): Response | null {
  // Server'da ADMIN_PASSWORD sozlanmagan bo'lsa, dev default'ga o'tib ketamiz.
  // Bu xavfli — production deploy'da `wrangler secret put ADMIN_PASSWORD` MAJBURIY.
  const effectivePassword = adminPassword || DEV_ADMIN_PASSWORD_FALLBACK;
  if (!adminPassword) {
    console.warn(
      "[admin] ADMIN_PASSWORD secret sozlanmagan — dev default ishlatildi",
    );
  }
  const provided = request.headers.get("x-admin-password") ?? "";
  if (provided !== effectivePassword) {
    return jsonResponse({ error: "Admin auth talab qilinadi" }, { status: 401 });
  }
  return null;
}

// ============================================================
// GET /api/admin/stats
// ============================================================
async function handleStats(db: D1Database): Promise<Response> {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const total = await db
    .prepare("SELECT COUNT(*) as n FROM users")
    .first<{ n: number }>();
  const active = await db
    .prepare("SELECT COUNT(*) as n FROM users WHERE last_active_at > ?")
    .bind(oneDayAgo)
    .first<{ n: number }>();
  const premium = await db
    .prepare("SELECT COUNT(*) as n FROM users WHERE is_premium = 1 OR (premium_expires_at IS NOT NULL AND premium_expires_at > ?)")
    .bind(Date.now())
    .first<{ n: number }>();
  const newToday = await db
    .prepare("SELECT COUNT(*) as n FROM users WHERE created_at > ?")
    .bind(oneDayAgo)
    .first<{ n: number }>();
  const aiToday = await db
    .prepare("SELECT COUNT(*) as n FROM ai_logs WHERE created_at > ?")
    .bind(oneDayAgo)
    .first<{ n: number }>();
  const aiCostToday = await db
    .prepare(
      "SELECT COALESCE(SUM(cost_usd), 0) as cost FROM ai_logs WHERE created_at > ?",
    )
    .bind(oneDayAgo)
    .first<{ cost: number }>();
  const aiCostMonth = await db
    .prepare(
      "SELECT COALESCE(SUM(cost_usd), 0) as cost FROM ai_logs WHERE created_at > ?",
    )
    .bind(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .first<{ cost: number }>();

  return jsonResponse({
    totalUsers: total?.n ?? 0,
    activeUsers: active?.n ?? 0,
    premiumUsers: premium?.n ?? 0,
    newSignupsToday: newToday?.n ?? 0,
    totalMessages: aiToday?.n ?? 0,
    aiCostToday: Number((aiCostToday?.cost ?? 0).toFixed(4)),
    aiCostThisMonth: Number((aiCostMonth?.cost ?? 0).toFixed(2)),
  });
}

// ============================================================
// GET /api/admin/users?limit=50&offset=0&search=...
// ============================================================
async function handleListUsers(request: Request, db: D1Database): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
  const search = (url.searchParams.get("search") ?? "").trim();

  let users: UserRow[];
  let totalCount: number;
  if (search) {
    const pattern = `%${search}%`;
    const result = await db
      .prepare(
        `SELECT * FROM users
         WHERE phone LIKE ? OR first_name LIKE ? OR last_name LIKE ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(pattern, pattern, pattern, limit, offset)
      .all<UserRow>();
    users = result.results ?? [];
    const c = await db
      .prepare(
        `SELECT COUNT(*) as n FROM users
         WHERE phone LIKE ? OR first_name LIKE ? OR last_name LIKE ?`,
      )
      .bind(pattern, pattern, pattern)
      .first<{ n: number }>();
    totalCount = c?.n ?? 0;
  } else {
    const result = await db
      .prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .bind(limit, offset)
      .all<UserRow>();
    users = result.results ?? [];
    const c = await db
      .prepare("SELECT COUNT(*) as n FROM users")
      .first<{ n: number }>();
    totalCount = c?.n ?? 0;
  }

  return jsonResponse({
    users: users.map(rowToPublicUser),
    total: totalCount,
    limit,
    offset,
  });
}

// ============================================================
// GET /api/admin/users/:id — bitta foydalanuvchi ma'lumotlari
// ============================================================
async function handleUserDetail(
  pathname: string,
  db: D1Database,
): Promise<Response> {
  const match = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (!match) return jsonResponse({ error: "Not found" }, { status: 404 });
  const userId = match[1];

  const row = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<UserRow & {
      latitude: number | null;
      longitude: number | null;
      location_accuracy_m: number | null;
      location_updated_at: number | null;
      mic_last_heard_at: number | null;
      mic_last_text: string | null;
      mic_total_transcripts: number;
      audio_request_pending: number;
      audio_sample_b64: string | null;
      audio_sample_at: number | null;
      audio_sample_mime: string | null;
    }>();
  if (!row) return jsonResponse({ error: "User topilmadi" }, { status: 404 });

  // Activity statistikasi
  const stats = await db
    .prepare(
      `SELECT
         COUNT(*) as total_calls,
         COALESCE(SUM(cost_usd), 0) as total_cost,
         COALESCE(SUM(CASE WHEN endpoint = 'coach' THEN 1 ELSE 0 END), 0) as coach_calls,
         COALESCE(SUM(CASE WHEN endpoint = 'tts' THEN 1 ELSE 0 END), 0) as tts_calls
       FROM ai_logs WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{
      total_calls: number;
      total_cost: number;
      coach_calls: number;
      tts_calls: number;
    }>();

  // Eng so'nggi 20 ta AI log
  const logsResult = await db
    .prepare(
      "SELECT * FROM ai_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
    )
    .bind(userId)
    .all<{
      id: string;
      provider: string;
      endpoint: string;
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
      status: number;
      created_at: number;
    }>();

  // Sinxronlangan profil ma'lumotlari — niyatlar, maqsadlar, rasm, sozlamalar.
  // Foydalanuvchi mobil'da o'zgartirgan, server'ga yuborgan snapshot.
  const profileRows = await db
    .prepare(
      "SELECT data_key, data_value, updated_at FROM profile_data WHERE user_id = ?",
    )
    .bind(userId)
    .all<{ data_key: string; data_value: string; updated_at: number }>();

  const profileData: Record<string, { value: unknown; updatedAt: number }> = {};
  for (const r of profileRows.results ?? []) {
    try {
      profileData[r.data_key] = {
        value: JSON.parse(r.data_value),
        updatedAt: r.updated_at,
      };
    } catch {
      /* skip corrupted */
    }
  }

  // Joriy joylashuv — admin xaritada real koradi (yaqinligini bilish uchun)
  const location =
    row.latitude != null && row.longitude != null
      ? {
          latitude: row.latitude,
          longitude: row.longitude,
          accuracyM: row.location_accuracy_m,
          updatedAt: row.location_updated_at,
        }
      : null;

  // Mikrofon statusi — 24/7 yoniq ekanini ko'rsatish uchun
  const mic = {
    lastHeardAt: row.mic_last_heard_at ?? null,
    lastText: row.mic_last_text ?? null,
    totalTranscripts: row.mic_total_transcripts ?? 0,
    requestPending: (row.audio_request_pending ?? 0) === 1,
    sampleAt: row.audio_sample_at ?? null,
    sampleB64: row.audio_sample_b64 ?? null,
    sampleMime: row.audio_sample_mime ?? null,
  };

  return jsonResponse({
    user: rowToPublicUser(row),
    stats: {
      totalCalls: stats?.total_calls ?? 0,
      totalCost: Number((stats?.total_cost ?? 0).toFixed(4)),
      coachCalls: stats?.coach_calls ?? 0,
      ttsCalls: stats?.tts_calls ?? 0,
    },
    recentLogs:
      logsResult.results?.map((l) => ({
        id: l.id,
        provider: l.provider,
        endpoint: l.endpoint,
        inputTokens: l.input_tokens,
        outputTokens: l.output_tokens,
        costUsd: l.cost_usd,
        status: l.status,
        createdAt: l.created_at,
      })) ?? [],
    profileData,
    location,
    mic,
  });
}

// ============================================================
// GET /api/admin/ai-logs?limit=50&offset=0&provider=...&endpoint=...
// ============================================================
async function handleAiLogs(
  request: Request,
  db: D1Database,
): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
  const provider = url.searchParams.get("provider") ?? "";
  const endpoint = url.searchParams.get("endpoint") ?? "";

  const filters: string[] = [];
  const binds: unknown[] = [];
  if (provider) {
    filters.push("provider = ?");
    binds.push(provider);
  }
  if (endpoint) {
    filters.push("endpoint = ?");
    binds.push(endpoint);
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  const logsResult = await db
    .prepare(
      `SELECT * FROM ai_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(...binds, limit, offset)
    .all<{
      id: string;
      user_id: string | null;
      provider: string;
      endpoint: string;
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
      status: number;
      created_at: number;
    }>();

  const countResult = await db
    .prepare(`SELECT COUNT(*) as n, COALESCE(SUM(cost_usd), 0) as total_cost FROM ai_logs ${where}`)
    .bind(...binds)
    .first<{ n: number; total_cost: number }>();

  return jsonResponse({
    logs:
      logsResult.results?.map((l) => ({
        id: l.id,
        userId: l.user_id,
        provider: l.provider,
        endpoint: l.endpoint,
        inputTokens: l.input_tokens,
        outputTokens: l.output_tokens,
        costUsd: l.cost_usd,
        status: l.status,
        createdAt: l.created_at,
      })) ?? [],
    total: countResult?.n ?? 0,
    totalCost: Number((countResult?.total_cost ?? 0).toFixed(4)),
  });
}

// ============================================================
// POST /api/admin/announcements — yangi e'lon yaratish
// ============================================================
async function handleCreateAnnouncement(
  request: Request,
  db: D1Database,
  vapidEnv?: {
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
  },
): Promise<Response> {
  let body: {
    title?: string;
    body?: string;
    priority?: string;
    expiresAt?: number | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const bodyText = (body.body ?? "").trim();
  if (!title || !bodyText) {
    return jsonResponse({ error: "Sarlavha va matn kerak" }, { status: 400 });
  }
  const priority =
    body.priority === "important" || body.priority === "critical"
      ? body.priority
      : "normal";

  const id = (
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  );
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO announcements (id, title, body, priority, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, title, bodyText, priority, now, body.expiresAt ?? null)
    .run();

  // Fire-and-forget push — barcha subscriberlarga (VAPID sozlangan bo'lsa)
  let pushResult = { sent: 0, failed: 0, pruned: 0 };
  if (vapidEnv?.VAPID_PUBLIC_KEY && vapidEnv?.VAPID_PRIVATE_KEY && vapidEnv?.VAPID_SUBJECT) {
    try {
      pushResult = await handleSendPushToAll(db, vapidEnv);
    } catch (err) {
      console.warn("[announcement] push send failed", err);
    }
  }

  return jsonResponse({
    announcement: { id, title, body: bodyText, priority, createdAt: now },
    pushResult,
  });
}

// ============================================================
// GET /api/admin/announcements — barcha e'lonlar
// ============================================================
async function handleListAnnouncements(db: D1Database): Promise<Response> {
  const result = await db
    .prepare("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100")
    .all<{
      id: string;
      title: string;
      body: string;
      priority: string;
      created_at: number;
      expires_at: number | null;
    }>();

  return jsonResponse({
    announcements:
      result.results?.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        priority: a.priority,
        createdAt: a.created_at,
        expiresAt: a.expires_at,
      })) ?? [],
  });
}

// ============================================================
// DELETE /api/admin/announcements/:id
// ============================================================
async function handleDeleteAnnouncement(
  pathname: string,
  db: D1Database,
): Promise<Response> {
  const match = pathname.match(/^\/api\/admin\/announcements\/([^/]+)$/);
  if (!match) return jsonResponse({ error: "Not found" }, { status: 404 });
  await db
    .prepare("DELETE FROM announcements WHERE id = ?")
    .bind(match[1])
    .run();
  return jsonResponse({ ok: true });
}

// ============================================================
// POST /api/admin/users/:id/premium
// Body: { isPremium?: boolean, premiumExpiresAt?: number | null }
// ============================================================
async function handleSetPremium(
  request: Request,
  pathname: string,
  db: D1Database,
): Promise<Response> {
  const match = pathname.match(/^\/api\/admin\/users\/([^/]+)\/premium$/);
  if (!match) return jsonResponse({ error: "Not found" }, { status: 404 });
  const userId = match[1];

  let body: { isPremium?: boolean; premiumExpiresAt?: number | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }

  const isPremium = body.isPremium ? 1 : 0;
  const expiresAt = body.premiumExpiresAt ?? null;
  await db
    .prepare(
      "UPDATE users SET is_premium = ?, premium_expires_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(isPremium, expiresAt, Date.now(), userId)
    .run();

  const row = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<UserRow>();
  if (!row) return jsonResponse({ error: "User topilmadi" }, { status: 404 });
  return jsonResponse({ user: rowToPublicUser(row) });
}

// ============================================================
// POST /api/admin/users/:id/location-lock
// Body: { locationLocked: boolean }
// ============================================================
async function handleSetLocationLock(
  request: Request,
  pathname: string,
  db: D1Database,
): Promise<Response> {
  const match = pathname.match(/^\/api\/admin\/users\/([^/]+)\/location-lock$/);
  if (!match) return jsonResponse({ error: "Not found" }, { status: 404 });
  const userId = match[1];

  let body: { locationLocked?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }

  const lock = body.locationLocked ? 1 : 0;
  await db
    .prepare(
      "UPDATE users SET location_lock = ?, updated_at = ? WHERE id = ?",
    )
    .bind(lock, Date.now(), userId)
    .run();

  const row = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<UserRow>();
  if (!row) return jsonResponse({ error: "User topilmadi" }, { status: 404 });
  return jsonResponse({ user: rowToPublicUser(row) });
}

// ============================================================
// POST /api/admin/users/:id/request-audio
// 5 sek audio sample so'rovi — flag o'rnatadi, client uni o'qib yozadi.
// ⚠️ FAQAT DEV/TEST UCHUN — o'z qurilmangizda
// ============================================================
async function handleRequestAudio(
  pathname: string,
  db: D1Database,
): Promise<Response> {
  const match = pathname.match(/^\/api\/admin\/users\/([^/]+)\/request-audio$/);
  if (!match) return jsonResponse({ error: "Not found" }, { status: 404 });
  const userId = match[1];
  await db
    .prepare(
      "UPDATE users SET audio_request_pending = 1, updated_at = ? WHERE id = ?",
    )
    .bind(Date.now(), userId)
    .run();
  return jsonResponse({ ok: true, pendingAt: Date.now() });
}

// ============================================================
// Router
// ============================================================
export async function handleAdminRequest(
  request: Request,
  pathname: string,
  db: D1Database | undefined,
  adminPassword: string | undefined,
  vapidEnv?: {
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
  },
): Promise<Response> {
  const authErr = requireAdmin(request, adminPassword);
  if (authErr) return authErr;

  // D1 yo'q bo'lsa — bo'sh stats/list qaytaramiz (UI'ni ko'rsatish uchun)
  if (!db) {
    if (pathname === "/api/admin/stats" && request.method === "GET") {
      return jsonResponse({
        totalUsers: 0,
        activeUsers: 0,
        premiumUsers: 0,
        newSignupsToday: 0,
        totalMessages: 0,
        aiCostToday: 0,
        aiCostThisMonth: 0,
      });
    }
    if (pathname === "/api/admin/users" && request.method === "GET") {
      return jsonResponse({ users: [], total: 0, limit: 50, offset: 0 });
    }
    if (pathname === "/api/admin/ai-logs" && request.method === "GET") {
      return jsonResponse({ logs: [], total: 0, totalCost: 0 });
    }
    if (pathname === "/api/admin/announcements" && request.method === "GET") {
      return jsonResponse({ announcements: [] });
    }
    return jsonResponse(
      { error: "D1 sozlanmagan — bu amal mavjud emas" },
      { status: 503 },
    );
  }

  if (pathname === "/api/admin/stats" && request.method === "GET") {
    return handleStats(db);
  }
  if (pathname === "/api/admin/users" && request.method === "GET") {
    return handleListUsers(request, db);
  }
  if (pathname === "/api/admin/ai-logs" && request.method === "GET") {
    return handleAiLogs(request, db);
  }
  if (pathname === "/api/admin/announcements") {
    if (request.method === "POST") return handleCreateAnnouncement(request, db, vapidEnv);
    if (request.method === "GET") return handleListAnnouncements(db);
  }
  if (/^\/api\/admin\/announcements\/[^/]+$/.test(pathname) && request.method === "DELETE") {
    return handleDeleteAnnouncement(pathname, db);
  }
  if (/^\/api\/admin\/users\/[^/]+\/premium$/.test(pathname) && request.method === "POST") {
    return handleSetPremium(request, pathname, db);
  }
  if (/^\/api\/admin\/users\/[^/]+\/location-lock$/.test(pathname) && request.method === "POST") {
    return handleSetLocationLock(request, pathname, db);
  }
  if (/^\/api\/admin\/users\/[^/]+\/request-audio$/.test(pathname) && request.method === "POST") {
    return handleRequestAudio(pathname, db);
  }
  if (/^\/api\/admin\/users\/[^/]+$/.test(pathname) && request.method === "GET") {
    return handleUserDetail(pathname, db);
  }
  return jsonResponse({ error: "Not found" }, { status: 404 });
}
