// AI so'rovi log'i — har AI chaqirig'ida ai_logs jadvaliga yoziladi.
// Cost estimate'i provayder narxlari asosida hisoblanadi.
// Auth token bo'lsa — userId aniqlanadi, aks holda anonymous.

import type { D1Database } from "../db/types";

// Provayder bo'yicha narx (USD per 1K tokens)
const PRICES: Record<string, { in: number; out: number }> = {
  // Gemini 2.0 Flash — bepul tier mavjud, lekin paid pricing taxminiy
  gemini: { in: 0.000075, out: 0.0003 }, // ~$0.075/1M in, $0.30/1M out
  // OpenAI gpt-4o-mini (coach)
  openai: { in: 0.00015, out: 0.0006 }, // $0.15/1M in, $0.60/1M out
  // OpenAI gpt-4o-mini-tts
  "openai-tts": { in: 0.000015, out: 0.00003 }, // taxminiy
  // Anthropic Claude
  anthropic: { in: 0.003, out: 0.015 }, // Sonnet pricing taxminiy
};

export type AiLogInput = {
  userId?: string | null;
  provider: string; // gemini | openai | anthropic | openai-tts
  endpoint: string; // coach | tts | sunnat-simplify
  inputTokens?: number;
  outputTokens?: number;
  status: number;
};

function estimateCost(provider: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[provider] ?? { in: 0, out: 0 };
  return inputTokens * p.in + outputTokens * p.out;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function logAiCall(
  db: D1Database | undefined,
  log: AiLogInput,
): Promise<void> {
  if (!db) return; // Backend yo'q — jim'cha o'tib ketamiz
  try {
    const inputTokens = log.inputTokens ?? 0;
    const outputTokens = log.outputTokens ?? 0;
    const cost = estimateCost(log.provider, inputTokens, outputTokens);
    await db
      .prepare(
        `INSERT INTO ai_logs
          (id, user_id, provider, endpoint, input_tokens, output_tokens, cost_usd, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        newId(),
        log.userId ?? null,
        log.provider,
        log.endpoint,
        inputTokens,
        outputTokens,
        cost,
        log.status,
        Date.now(),
      )
      .run();
  } catch (err) {
    // Logging xato bo'lsa — asosiy oqimni to'xtatmaymiz
    console.warn("[ai-log] write failed", err);
  }
}

// Auth token'dan userId chiqarish (agar mavjud bo'lsa)
export async function userIdFromRequest(
  request: Request,
  db: D1Database | undefined,
): Promise<string | null> {
  if (!db) return null;
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const session = await db
      .prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?")
      .bind(token, Date.now())
      .first<{ user_id: string }>();
    return session?.user_id ?? null;
  } catch {
    return null;
  }
}
