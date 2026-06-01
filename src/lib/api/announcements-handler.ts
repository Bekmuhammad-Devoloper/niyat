// Public endpoint — foydalanuvchi ilovasi joriy e'lonlarni olib ko'rsatadi.
// GET /api/announcements — barcha aktiv (expires_at NULL yoki kelajakda) e'lonlar

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

export async function handleAnnouncementsRequest(
  request: Request,
  db: D1Database | undefined,
): Promise<Response> {
  if (!db) {
    // Backend yo'q — bo'sh ro'yxat qaytaramiz (xato emas, graceful)
    return jsonResponse({ announcements: [] });
  }
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const now = Date.now();
  const result = await db
    .prepare(
      "SELECT * FROM announcements WHERE expires_at IS NULL OR expires_at > ? ORDER BY created_at DESC LIMIT 20",
    )
    .bind(now)
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
