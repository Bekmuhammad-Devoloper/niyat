// Web Push Notifications — VAPID asoslangan.
// Foydalanuvchi browser yopiq bo'lsa ham push xabar keladi (Android/Desktop'da).
//
// VAPID kalitlar yaratish (CLI'da bir martagina):
//   npx web-push generate-vapid-keys
// Chiqarilgan public va private kalitlarni Cloudflare secret'larida saqlang:
//   npx wrangler secret put VAPID_PUBLIC_KEY
//   npx wrangler secret put VAPID_PRIVATE_KEY
//   npx wrangler secret put VAPID_SUBJECT  # masalan "mailto:admin@niyat.uz"
//
// Workers'da node Buffer va crypto yo'q — Web Crypto API bilan qo'lda
// VAPID JWT generatsiya qilamiz va push service'ga jo'natamiz (payload'siz).
// SW push event'ida server'dan latest announcement'ni fetch qiladi.

import type { D1Database } from "../db/types";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// =============================================================
// VAPID JWT — ES256 (ECDSA P-256) bilan imzolanadi
// =============================================================

function base64UrlEncode(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = input;
  }
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// VAPID privateKey (32 bayt scalar, base64url) → CryptoKey.
// WebCrypto JWK uchun `x`,`y` ham talab qiladi, lekin bizda faqat scalar bor.
// Yechim: scalar'dan public point'ni P-256 generator bilan derive qilish
// (qisqa scalar ko'paytirish — Workers'da node yo'q, sof JS bilan).
// Bu Cloudflare Workers'da ham, Node 18+ da ham ishlaydi.
async function importVapidPrivateKey(base64Url: string): Promise<CryptoKey> {
  const dBytes = base64UrlDecode(base64Url);
  if (dBytes.length !== 32) {
    throw new Error(
      `VAPID private key 32 bayt bo'lishi kerak (kelgan: ${dBytes.length})`,
    );
  }
  const { x, y } = p256ScalarToPublicPoint(dBytes);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: base64UrlEncode(dBytes),
    x: base64UrlEncode(x),
    y: base64UrlEncode(y),
    ext: false,
  };
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

// ============================================================
// P-256 scalar -> public point (G * d).
// Sof BigInt yordamida point doubling/addition. Cloudflare Workers'da
// xavfsiz, fexternal kerak emas.
// ============================================================
const P256_P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const P256_A = 0xffffffff00000001000000000000000000000000fffffffffffffffffffffffcn;
const P256_GX = 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n;
const P256_GY = 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n;

function mod(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

function modInverse(a: bigint, m: bigint): bigint {
  // Kengaytirilgan Yevklid algoritmi
  let [oldR, r] = [mod(a, m), m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return mod(oldS, m);
}

type Point = { x: bigint; y: bigint } | null; // null = infinity

function pointDouble(p: Point): Point {
  if (p === null) return null;
  const { x, y } = p;
  if (y === 0n) return null;
  const lambda = mod((3n * x * x + P256_A) * modInverse(2n * y, P256_P), P256_P);
  const x3 = mod(lambda * lambda - 2n * x, P256_P);
  const y3 = mod(lambda * (x - x3) - y, P256_P);
  return { x: x3, y: y3 };
}

function pointAdd(p: Point, q: Point): Point {
  if (p === null) return q;
  if (q === null) return p;
  if (p.x === q.x) {
    if (mod(p.y + q.y, P256_P) === 0n) return null;
    return pointDouble(p);
  }
  const lambda = mod((q.y - p.y) * modInverse(q.x - p.x, P256_P), P256_P);
  const x3 = mod(lambda * lambda - p.x - q.x, P256_P);
  const y3 = mod(lambda * (p.x - x3) - p.y, P256_P);
  return { x: x3, y: y3 };
}

function scalarMult(k: bigint, p: Point): Point {
  let result: Point = null;
  let addend: Point = p;
  let scalar = k;
  while (scalar > 0n) {
    if (scalar & 1n) result = pointAdd(result, addend);
    addend = pointDouble(addend);
    scalar >>= 1n;
  }
  return result;
}

function bigIntToBytes(n: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let v = n;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}

function p256ScalarToPublicPoint(d: Uint8Array): { x: Uint8Array; y: Uint8Array } {
  const k = bytesToBigInt(d);
  const G: Point = { x: P256_GX, y: P256_GY };
  const pub = scalarMult(k, G);
  if (pub === null) throw new Error("VAPID kalit infinity nuqtaga olib keldi");
  return { x: bigIntToBytes(pub.x, 32), y: bigIntToBytes(pub.y, 32) };
}

async function signVapidJwt(
  privateKeyB64: string,
  audience: string,
  subject: string,
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 soat
    sub: subject,
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importVapidPrivateKey(privateKeyB64);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

// =============================================================
// Push subscription endpoint
// =============================================================

type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

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

// POST /api/push/subscribe — browser PushSubscription'ni saqlash
async function handleSubscribe(
  request: Request,
  db: D1Database,
): Promise<Response> {
  let body: PushSubscriptionInput;
  try {
    body = (await request.json()) as PushSubscriptionInput;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return jsonResponse({ error: "Subscription noto'g'ri" }, { status: 400 });
  }

  const userId = await userIdFromBearer(request, db);
  const userAgent = request.headers.get("user-agent") ?? null;
  const now = Date.now();

  // Bir xil endpoint allaqachon saqlangan bo'lishi mumkin — upsert
  await db
    .prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         last_used_at = excluded.last_used_at`,
    )
    .bind(
      newId(),
      userId,
      body.endpoint,
      body.keys.p256dh,
      body.keys.auth,
      userAgent,
      now,
      now,
    )
    .run();

  return jsonResponse({ ok: true });
}

// =============================================================
// Send push to all subscribers
// =============================================================

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function sendPushTo(
  sub: PushSubscriptionRow,
  vapidPrivateKey: string,
  vapidPublicKey: string,
  vapidSubject: string,
): Promise<{ ok: boolean; status: number }> {
  try {
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await signVapidJwt(vapidPrivateKey, audience, vapidSubject);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        TTL: "86400",
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
        // Empty payload — SW server'dan kontentni o'zi tortib oladi
        "Content-Length": "0",
      },
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.warn("[push] send failed", err);
    return { ok: false, status: 0 };
  }
}

// POST /api/admin/push/send — barcha aktiv obunalarga push yuborish
export async function handleSendPushToAll(
  db: D1Database,
  env: {
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
  },
): Promise<{ sent: number; failed: number; pruned: number }> {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return { sent: 0, failed: 0, pruned: 0 };
  }

  const result = await db
    .prepare(
      "SELECT endpoint, p256dh, auth FROM push_subscriptions ORDER BY last_used_at DESC LIMIT 1000",
    )
    .all<PushSubscriptionRow>();

  let sent = 0;
  let failed = 0;
  const deadEndpoints: string[] = [];
  const subscriptions = result.results ?? [];
  const BATCH_SIZE = 10;
  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((sub) =>
        sendPushTo(sub, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT).then(
          (r) => ({ ...r, endpoint: sub.endpoint }),
        ),
      ),
    );
    for (const r of results) {
      if (r.ok) sent++;
      else failed++;
      // 404/410 — endpoint o'lik (foydalanuvchi obunani bekor qildi yoki o'chirdi).
      // DB'dan o'chirib tashlaymiz, qaytadan urinmaymiz.
      if (r.status === 404 || r.status === 410) {
        deadEndpoints.push(r.endpoint);
      }
    }
  }
  // O'lik endpointlarni tozalash
  for (const endpoint of deadEndpoints) {
    try {
      await db
        .prepare("DELETE FROM push_subscriptions WHERE endpoint = ?")
        .bind(endpoint)
        .run();
    } catch (err) {
      console.warn("[push] dead subscription delete failed", err);
    }
  }
  return { sent, failed, pruned: deadEndpoints.length };
}

// =============================================================
// GET /api/push/vapid-public-key — frontend uchun (subscribe paytida)
// =============================================================

export async function handlePushRequest(
  request: Request,
  pathname: string,
  db: D1Database | undefined,
  env: { VAPID_PUBLIC_KEY?: string },
): Promise<Response> {
  if (pathname === "/api/push/vapid-public-key" && request.method === "GET") {
    return jsonResponse({ publicKey: env.VAPID_PUBLIC_KEY ?? "" });
  }
  if (pathname === "/api/push/subscribe" && request.method === "POST") {
    if (!db) return jsonResponse({ error: "Backend yo'q" }, { status: 503 });
    return handleSubscribe(request, db);
  }
  return jsonResponse({ error: "Not found" }, { status: 404 });
}
