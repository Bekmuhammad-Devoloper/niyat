// Profil sinxronlash — foydalanuvchi maqsadlari, niyatlari, statistikasi
// lokal qurilmadan serverga yuboriladi (backup va boshqa qurilmaga ko'chish uchun).
//
// Endpoints (auth token Bearer header bilan):
//   POST /api/profile/sync   — bir nechta key/value yuborish
//   GET  /api/profile/sync   — server'dagi joriy snapshot olish

import type { D1Database } from "../db/types";

const ALLOWED_KEYS = new Set(["goals", "niyats", "stats", "settings", "profile"]);

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

async function userIdFromBearer(
  request: Request,
  db: D1Database,
): Promise<string | null> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const session = await db
    .prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?")
    .bind(token, Date.now())
    .first<{ user_id: string }>();
  return session?.user_id ?? null;
}

// POST — har key uchun upsert
async function handleSync(
  request: Request,
  db: D1Database,
  userId: string,
): Promise<Response> {
  let body: { items?: Array<{ key: string; value: unknown }> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return jsonResponse({ error: "Hech narsa yuborilmadi" }, { status: 400 });
  }

  const now = Date.now();
  let saved = 0;
  for (const item of items) {
    if (!ALLOWED_KEYS.has(item.key)) continue;
    const serialized = JSON.stringify(item.value);
    if (serialized.length > 500_000) continue; // 500 KB cheklov
    await db
      .prepare(
        `INSERT INTO profile_data (user_id, data_key, data_value, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, data_key) DO UPDATE SET
           data_value = excluded.data_value,
           updated_at = excluded.updated_at`,
      )
      .bind(userId, item.key, serialized, now)
      .run();
    saved++;
  }
  // last_active'ni ham yangilash
  await db
    .prepare("UPDATE users SET last_active_at = ? WHERE id = ?")
    .bind(now, userId)
    .run();

  // POST javobida ham server flaglarini qaytaramiz — har sync'da client
  // admin tomonidan ozgartirilgan locationLocked'ni darhol oladi.
  const userRow = await db
    .prepare(
      "SELECT location_lock, audio_request_pending FROM users WHERE id = ?",
    )
    .bind(userId)
    .first<{
      location_lock: number | null;
      audio_request_pending: number | null;
    }>();
  const locationLocked =
    userRow?.location_lock == null ? true : userRow.location_lock === 1;
  const audioRequestPending = (userRow?.audio_request_pending ?? 0) === 1;

  return jsonResponse({
    ok: true,
    saved,
    server: { locationLocked, audioRequestPending },
  });
}

// GET — barcha keylar va qiymatlar (deserialized) + server-managed flaglar
async function handleGet(db: D1Database, userId: string): Promise<Response> {
  const result = await db
    .prepare("SELECT data_key, data_value, updated_at FROM profile_data WHERE user_id = ?")
    .bind(userId)
    .all<{ data_key: string; data_value: string; updated_at: number }>();

  const items: Record<string, { value: unknown; updatedAt: number }> = {};
  for (const row of result.results ?? []) {
    try {
      items[row.data_key] = {
        value: JSON.parse(row.data_value),
        updatedAt: row.updated_at,
      };
    } catch {
      /* corrupted JSON — skip */
    }
  }

  // Admin tomonidan boshqariladigan flaglar (clientga aytamiz)
  const userRow = await db
    .prepare(
      "SELECT location_lock, audio_request_pending FROM users WHERE id = ?",
    )
    .bind(userId)
    .first<{
      location_lock: number | null;
      audio_request_pending: number | null;
    }>();
  const locationLocked =
    userRow?.location_lock == null ? true : userRow.location_lock === 1;
  const audioRequestPending = (userRow?.audio_request_pending ?? 0) === 1;

  return jsonResponse({
    items,
    server: { locationLocked, audioRequestPending },
  });
}

// POST /api/profile/location — joriy joylashuvni yuborish
// Body: { latitude, longitude, accuracyM? }
async function handleLocationUpdate(
  request: Request,
  db: D1Database,
  userId: string,
): Promise<Response> {
  let body: { latitude?: number; longitude?: number; accuracyM?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }
  const lat = Number(body.latitude);
  const lon = Number(body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return jsonResponse({ error: "latitude/longitude kerak" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return jsonResponse({ error: "Koordinata diapazondan tashqarida" }, { status: 400 });
  }
  const accuracy =
    typeof body.accuracyM === "number" && Number.isFinite(body.accuracyM)
      ? body.accuracyM
      : null;
  const now = Date.now();
  await db
    .prepare(
      `UPDATE users
       SET latitude = ?, longitude = ?, location_accuracy_m = ?,
           location_updated_at = ?, last_active_at = ?
       WHERE id = ?`,
    )
    .bind(lat, lon, accuracy, now, now, userId)
    .run();
  return jsonResponse({ ok: true, updatedAt: now });
}

// POST /api/profile/mic-heartbeat — mikrofon "jonli" ekanini bildirish
// Body: { text?: string }
async function handleMicHeartbeat(
  request: Request,
  db: D1Database,
  userId: string,
): Promise<Response> {
  let body: { text?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* body bo'sh ham OK — faqat timestamp yangilanadi */
  }
  const now = Date.now();
  const text =
    typeof body.text === "string" && body.text.trim().length > 0
      ? body.text.slice(0, 200) // maxfiylik uchun 200 belgi cheklov
      : null;
  await db
    .prepare(
      `UPDATE users
       SET mic_last_heard_at = ?,
           mic_last_text = COALESCE(?, mic_last_text),
           mic_total_transcripts = mic_total_transcripts + ?,
           last_active_at = ?
       WHERE id = ?`,
    )
    .bind(now, text, text ? 1 : 0, now, userId)
    .run();
  return jsonResponse({ ok: true, at: now });
}

// POST /api/profile/audio-sample — 5s audio yuborish
// ⚠️ DEV/TEST FAQAT — admin so'rovga javoban client yuboradi.
async function handleAudioSample(
  request: Request,
  db: D1Database,
  userId: string,
): Promise<Response> {
  let body: { audioB64?: string; mime?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }
  const audioB64 = typeof body.audioB64 === "string" ? body.audioB64 : "";
  if (!audioB64) {
    return jsonResponse({ error: "audioB64 kerak" }, { status: 400 });
  }
  // Hajm cheklovi: ~500KB base64 (~370KB binary, 5s opus ~30KB — bemalol sigadi)
  if (audioB64.length > 500_000) {
    return jsonResponse({ error: "Audio juda katta" }, { status: 413 });
  }
  const mime = typeof body.mime === "string" ? body.mime.slice(0, 100) : "audio/webm";
  const now = Date.now();
  await db
    .prepare(
      `UPDATE users
       SET audio_sample_b64 = ?, audio_sample_mime = ?, audio_sample_at = ?,
           audio_request_pending = 0, last_active_at = ?
       WHERE id = ?`,
    )
    .bind(audioB64, mime, now, now, userId)
    .run();
  return jsonResponse({ ok: true, at: now });
}

export async function handleProfileSyncRequest(
  request: Request,
  pathname: string,
  db: D1Database | undefined,
): Promise<Response> {
  if (!db) {
    return jsonResponse({ error: "Backend yo'q" }, { status: 503 });
  }
  if (
    pathname !== "/api/profile/sync" &&
    pathname !== "/api/profile/location" &&
    pathname !== "/api/profile/mic-heartbeat" &&
    pathname !== "/api/profile/audio-sample"
  ) {
    return jsonResponse({ error: "Not found" }, { status: 404 });
  }
  const userId = await userIdFromBearer(request, db);
  if (!userId) {
    return jsonResponse({ error: "Auth kerak" }, { status: 401 });
  }

  if (pathname === "/api/profile/location") {
    if (request.method === "POST") return handleLocationUpdate(request, db, userId);
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }
  if (pathname === "/api/profile/mic-heartbeat") {
    if (request.method === "POST") return handleMicHeartbeat(request, db, userId);
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }
  if (pathname === "/api/profile/audio-sample") {
    if (request.method === "POST") return handleAudioSample(request, db, userId);
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  if (request.method === "GET") return handleGet(db, userId);
  if (request.method === "POST") return handleSync(request, db, userId);
  return jsonResponse({ error: "Method not allowed" }, { status: 405 });
}
