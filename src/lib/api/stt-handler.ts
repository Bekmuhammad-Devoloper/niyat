// OpenAI Whisper bilan audio transkripsiya. Capacitor WebView Web Speech
// API'ni ishonchli qo'llab-quvvatlamasligi sababli, ovozli muloqotda
// MediaRecorder bilan yozib shu endpoint'ga jo'natamiz.
//
// Whisper-1 modeli o'zbek tilini yaxshi tushunadi (lekin transkripsiya
// avtomatik lotin yozuvida emas, lokal alifboda chiqishi mumkin — biz
// "uz" hint berib lotin so'rab olamiz).
//
// Request: multipart/form-data, "audio" maydoni
// Response: { text: string }

import OpenAI, { toFile } from "openai";
import { logAiCall, userIdFromRequest } from "./ai-log";
import type { D1Database } from "../db/types";

const STT_MODEL = "whisper-1";

export async function handleSttRequest(
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid form data" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob)) {
    return new Response(JSON.stringify({ error: "audio file required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Til hint — "uz" (Whisper'ning ISO-639-1 kodi). Bo'lmasa avtomatik aniqlanadi.
  const langHint = (formData.get("lang") as string | null) ?? "uz";

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const buffer = await audio.arrayBuffer();
    const file = await toFile(buffer, "audio.webm", {
      type: audio.type || "audio/webm",
    });

    const result = await openai.audio.transcriptions.create({
      model: STT_MODEL,
      file,
      language: langHint || undefined,
      response_format: "json",
      // Promptni biroz islomiy kontekstga moslab beramiz — "niyat", "namoz",
      // ismlar to'g'ri eshitilishi uchun.
      prompt:
        "Bu Niyat AI hayot murabbiy ilovasi. Foydalanuvchi o'zbek tilida " +
        "gapiradi. Mavzular: niyat, maqsad, namoz, Qur'on, oila. " +
        "Ismlar: Bekmuhammad, Olloh, Muhammad sollallohu alayhi va sallam.",
    });

    const text = result.text?.trim() ?? "";

    const userId = await userIdFromRequest(request, db);
    void logAiCall(db, {
      userId,
      provider: "openai-stt",
      endpoint: "stt",
      inputTokens: Math.round(buffer.byteLength / 1000), // taxminiy
      outputTokens: text.length,
      status: 200,
    });

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError) {
      return new Response(
        JSON.stringify({ error: "Hozir ko'p so'rov keldi, biroz kutib turing." }),
        { status: 429, headers: { "content-type": "application/json" } },
      );
    }
    if (err instanceof OpenAI.APIError) {
      console.error("Whisper STT error", err.status, err.message);
      return new Response(JSON.stringify({ error: "STT xatosi" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("STT unexpected error", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "STT xatosi",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
