// Backend auth — D1 ma'lumotlar bazasi bilan.
// Endpoints:
//   POST /api/auth/register  — yangi foydalanuvchi
//   POST /api/auth/login     — telefon + parol bilan kirish
//   GET  /api/auth/me        — joriy foydalanuvchi (Bearer token)

import type { D1Database, UserRow } from "../db/types";
import { rowToPublicUser } from "../db/types";

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 kun

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

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(`niyat-salt:${input}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = newId();
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(token, userId, now, now + SESSION_TTL_MS)
    .run();
  return token;
}

// ============================================================
// POST /api/auth/register
// Body: { firstName, lastName, phone, password }
// ============================================================
async function handleRegister(request: Request, db: D1Database): Promise<Response> {
  let body: { firstName?: string; lastName?: string; phone?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const password = body.password ?? "";

  if (!/^\+998\d{9}$/.test(phone)) {
    return jsonResponse({ error: "Telefon raqam noto'g'ri" }, { status: 400 });
  }
  if (firstName.length < 2 || firstName.length > 50) {
    return jsonResponse({ error: "Ism 2-50 belgi bo'lishi kerak" }, { status: 400 });
  }
  if (password.length < 6) {
    return jsonResponse(
      { error: "Parol kamida 6 belgi bo'lishi kerak" },
      { status: 400 },
    );
  }

  // Mavjud foydalanuvchi tekshiruvi
  const existing = await db
    .prepare("SELECT id FROM users WHERE phone = ?")
    .bind(phone)
    .first<{ id: string }>();
  if (existing) {
    return jsonResponse(
      { error: "Bu telefon raqam bilan hisob mavjud" },
      { status: 409 },
    );
  }

  const id = newId();
  const passwordHash = await sha256Hex(password);
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO users
        (id, phone, first_name, last_name, password_hash, is_premium,
         premium_expires_at, created_at, updated_at, last_active_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
    )
    .bind(id, phone, firstName, lastName, passwordHash, now, now, now)
    .run();

  const token = await createSession(db, id);
  const row = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<UserRow>();
  if (!row) {
    return jsonResponse({ error: "User yaratishda xatolik" }, { status: 500 });
  }

  return jsonResponse({ token, user: rowToPublicUser(row) });
}

// ============================================================
// POST /api/auth/login
// Body: { phone, password }
// ============================================================
async function handleLogin(request: Request, db: D1Database): Promise<Response> {
  let body: { phone?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  const password = body.password ?? "";

  if (!phone || !password) {
    return jsonResponse({ error: "Telefon va parol kerak" }, { status: 400 });
  }

  const row = await db
    .prepare("SELECT * FROM users WHERE phone = ?")
    .bind(phone)
    .first<UserRow>();
  if (!row) {
    return jsonResponse({ error: "Telefon yoki parol noto'g'ri" }, { status: 401 });
  }

  const passwordHash = await sha256Hex(password);
  if (passwordHash !== row.password_hash) {
    return jsonResponse({ error: "Telefon yoki parol noto'g'ri" }, { status: 401 });
  }

  const token = await createSession(db, row.id);
  // last_active_at yangilash
  await db
    .prepare("UPDATE users SET last_active_at = ? WHERE id = ?")
    .bind(Date.now(), row.id)
    .run();

  return jsonResponse({ token, user: rowToPublicUser(row) });
}

// ============================================================
// GET /api/auth/me
// Header: Authorization: Bearer <token>
// ============================================================
async function handleMe(request: Request, db: D1Database): Promise<Response> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return jsonResponse({ error: "Token kerak" }, { status: 401 });
  }

  const session = await db
    .prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > ?")
    .bind(token, Date.now())
    .first<{ token: string; user_id: string; expires_at: number }>();
  if (!session) {
    return jsonResponse({ error: "Token noto'g'ri yoki muddati o'tgan" }, { status: 401 });
  }

  const row = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(session.user_id)
    .first<UserRow>();
  if (!row) {
    return jsonResponse({ error: "User topilmadi" }, { status: 404 });
  }

  return jsonResponse({ user: rowToPublicUser(row) });
}

// ============================================================
// Router — yo'naltirish
// ============================================================
export async function handleAuthRequest(
  request: Request,
  pathname: string,
  db: D1Database | undefined,
): Promise<Response> {
  if (!db) {
    return jsonResponse(
      { error: "Backend ulanmagan (D1 sozlanmagan)" },
      { status: 503 },
    );
  }
  if (pathname === "/api/auth/register" && request.method === "POST") {
    return handleRegister(request, db);
  }
  if (pathname === "/api/auth/login" && request.method === "POST") {
    return handleLogin(request, db);
  }
  if (pathname === "/api/auth/me" && request.method === "GET") {
    return handleMe(request, db);
  }
  return jsonResponse({ error: "Not found" }, { status: 404 });
}
