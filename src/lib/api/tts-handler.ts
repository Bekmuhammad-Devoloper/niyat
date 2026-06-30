// OpenAI TTS — odam ovozi kabi tabiiy tilovat.
//
// `gpt-4o-mini-tts` modeli eng yangi va eng tabiiy. `instructions` parametri
// orqali ohang/iltifot boshqarilishi mumkin — bu Murabbiy uchun ideal.
// Default ovoz: "coral" — eng tabiiy multilingual ayol ovozi (2024-oktabr
// yangiligi). O'zbek matnini ham aksentsiz va yumshoq talaffuz qiladi.
//
// Narxlar: ~$0.015/1K input + $0.030/1K output (har coach javobi ~$0.005-0.01)
// Cache: brauzer HTTP cache (1 kun) + memory cache (mijoz tomonida)

import OpenAI from "openai";
import { logAiCall, userIdFromRequest } from "./ai-log";
import type { D1Database } from "../db/types";

const TTS_MODEL = "gpt-4o-mini-tts";
// Ovoz tanlovi — Murabbiy uchun iliq, samimiy, tabiiy ayol ovozi
// alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse
// coral = eng yangi (2024-okt) multilingual ayol ovozi — eng natural
const DEFAULT_VOICE = "coral";

// Ohang ko'rsatmasi — gpt-4o-mini-tts uchun. Sun'iy emas, ayol do'st kabi gapirsin.
const VOICE_INSTRUCTIONS =
  "Speak in a warm, gentle, and natural conversational tone like a caring elder sister or a trusted female spiritual mentor. " +
  "Use soft emotional inflection, natural pauses, and a steady calm pace — not robotic. " +
  "Speak Uzbek text with a clear, accent-free pronunciation, preserving Latin-script Uzbek spelling (sh, ch, oʻ, gʻ, ng). " +
  "Do NOT speak with a Turkish, Russian, or English accent — pronounce Uzbek words as a native Uzbek speaker would. " +
  "Stretch vowels lightly, let words breathe. Sound like a real woman speaking to a close friend with empathy and warmth — never flat, never mechanical. " +
  "Names like Bekmuhammad, Olloh, Muhammad sollallohu alayhi va sallam must be pronounced with reverence and a brief gentle pause.";

// Eslatma uchun maxsus ohang — mehribon ona kabi, yumshoq, samimiy,
// lekin so'zlarni aniq talaffuz qilsin. Uzbek/Turkic so'zlarni nutq
// ravonligi bilan o'qisin.
const REMINDER_INSTRUCTIONS =
  "You are a beloved Uzbek mother whispering a heartfelt reminder to her child whom she loves dearly. " +
  "Voice character: deeply warm, melodic, soft, soulful, genuinely emotional — NEVER monotone, NEVER mechanical. " +
  "Speak as if you are physically next to your child, almost in a whisper, with palpable love and tenderness. " +
  "Take generous natural pauses between phrases — breathe like a human, not a robot. " +
  "Pronounce Arabic-origin words ('sollallohu alayhi va sallam', 'ummatidan') slowly and with reverence and a slight pause of respect. " +
  "Emphasize the child's name with warmth, as a mother would when calling her dearest. " +
  "Stretch vowels slightly. Let the voice rise and fall naturally with emotion. " +
  "End the sentence with a gentle, slightly sad sigh — as if you're heartbroken your child forgot, but you forgive them with love. " +
  "If this sounds like a generic TTS robot, you have failed. Sound human. Sound like a mother.";

export type TtsRequestBody = {
  text: string;
  voice?: string;
  speed?: number; // 0.25 - 4.0
  mode?: "default" | "reminder"; // reminder = maxsus mehribon ona ohangi
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
  const instructions =
    body.mode === "reminder" ? REMINDER_INSTRUCTIONS : VOICE_INSTRUCTIONS;

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    // gpt-4o-mini-tts `instructions` parametrini qo'llab-quvvatlaydi —
    // ovozni "warm, caring, conversational" qilib boshqaramiz.
    const ttsResponse = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice,
      input: text,
      instructions,
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
