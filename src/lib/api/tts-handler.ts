// OpenAI TTS — odam ovozi kabi tabiiy tilovat.
//
// `gpt-4o-mini-tts` modeli eng yangi va eng tabiiy. `instructions` parametri
// orqali ohang/iltifot boshqarilishi mumkin — bu Murabbiy uchun ideal.
// Default ovoz: "ash" — iliq, samimiy, do'stona erkak ovozi.
//
// Narxlar: ~$0.015/1K input + $0.030/1K output (har coach javobi ~$0.005-0.01)
// Cache: brauzer HTTP cache (1 kun) + memory cache (mijoz tomonida)

import OpenAI from "openai";
import { logAiCall, userIdFromRequest } from "./ai-log";
import type { D1Database } from "../db/types";

const TTS_MODEL = "gpt-4o-mini-tts";
// Ovoz tanlovi — Murabbiy uchun iliq, samimiy erkak ovozi
// alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse
const DEFAULT_VOICE = "ash";

// Ohang ko'rsatmasi — gpt-4o-mini-tts uchun. Sun'iy emas, do'st kabi gapirsin.
const VOICE_INSTRUCTIONS =
  "Speak in a warm, gentle, and natural conversational tone like a caring older brother or trusted spiritual mentor. " +
  "Use soft emotional inflection, natural pauses, and a steady calm pace — not robotic. " +
  "Speak Uzbek text with care and sincerity, as if comforting a friend. " +
  "Show empathy and warmth in your voice — never sound flat or mechanical.";

export type TtsRequestBody = {
  text: string;
  voice?: string;
  speed?: number; // 0.25 - 4.0
};

export async function handleTtsRequest(
  request: Request,
  openaiKey: string | undefined,
  db?: D1Database,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }
  if (!openaiKey) {
    return new Response(
      JSON.stringify({
        error: "OPENAI_API_KEY sozlanmagan",
        hint: ".env'da OPENAI_API_KEY=sk-... ni qo'shing",
      }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  let body: TtsRequestBody;
  try {
    body = (await request.json()) as TtsRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return new Response(JSON.stringify({ error: "Text is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (text.length > 4000) {
    return new Response(JSON.stringify({ error: "Text too long (max 4000)" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const voice = body.voice ?? DEFAULT_VOICE;
  const speed = Math.max(0.5, Math.min(2.0, body.speed ?? 1.0));

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    // gpt-4o-mini-tts `instructions` parametrini qo'llab-quvvatlaydi —
    // ovozni "warm, caring, conversational" qilib boshqaramiz.
    const ttsResponse = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice,
      input: text,
      instructions: VOICE_INSTRUCTIONS,
      response_format: "mp3",
      speed,
    } as Parameters<typeof openai.audio.speech.create>[0]);

    const buffer = await ttsResponse.arrayBuffer();
    // AI log — TTS uchun input = text.length (taxminiy tokens), output = audio duration estimate
    const userId = await userIdFromRequest(request, db);
    void logAiCall(db, {
      userId,
      provider: "openai-tts",
      endpoint: "tts",
      inputTokens: text.length,
      outputTokens: Math.round(buffer.byteLength / 100), // rough proxy
      status: 200,
    });
    return new Response(buffer, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "content-length": String(buffer.byteLength),
        // 1 kunlik cache — bir xil matn uchun qayta so'rov yubormaslik
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError) {
      return new Response(
        JSON.stringify({ error: "Hozir ko'p so'rov keldi, biroz kutib turing." }),
        { status: 429, headers: { "content-type": "application/json" } },
      );
    }
    if (err instanceof OpenAI.APIError) {
      console.error("OpenAI TTS error", err.status, err.message);
      return new Response(JSON.stringify({ error: "TTS xatosi" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("TTS unexpected error", err);
    return new Response(JSON.stringify({ error: "TTS xatosi" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
