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

// Whisper-1 modeli rasman qo'llab-quvvatlaydigan tillar (ISO-639-1).
// "uz" (o'zbek) ro'yxatda YO'Q — agar foydalanuvchi "uz" so'rasa, biz
// language parametrini umuman bermaymiz va Whisper avtomatik aniqlashga
// qoldiramiz. Prompt o'zbekcha kontekstga moslangan.
const WHISPER_SUPPORTED_LANGS = new Set([
  "af","ar","hy","az","be","bs","bg","ca","zh","hr","cs","da","nl","en","et",
  "fi","fr","gl","de","el","he","hi","hu","is","id","it","ja","kn","kk","ko",
  "lv","lt","mk","ms","mr","mi","ne","no","fa","pl","pt","ro","ru","sr","sk",
  "sl","es","sw","sv","tl","ta","th","tr","uk","ur","vi","cy",
]);

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

  // Til hint — agar Whisper qabul qiluvchi til bo'lsa beramiz, aks holda
  // (masalan "uz") undefined qilamiz va avto-aniqlash ishlaydi.
  const rawLang = (formData.get("lang") as string | null) ?? "";
  const langHint = WHISPER_SUPPORTED_LANGS.has(rawLang.toLowerCase())
    ? rawLang.toLowerCase()
    : undefined;

  // Whisper filename kengaytmasini content-type bilan moslashtirib yuboradi.
  // Native plugin "audio/mp4" m4a yuboradi; web MediaRecorder "audio/webm";
  // mos bo'lmagan filename'da Whisper 400 qaytaradi.
  const mime = (audio.type || "audio/webm").toLowerCase();
  const ext = mime.includes("mp4") || mime.includes("m4a")
    ? "m4a"
    : mime.includes("aac")
      ? "aac"
      : mime.includes("mpeg") || mime.includes("mp3")
        ? "mp3"
        : mime.includes("wav")
          ? "wav"
          : mime.includes("ogg")
            ? "ogg"
            : "webm";
  const filename = `audio.${ext}`;

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const buffer = await audio.arrayBuffer();
    console.log(
      `[stt] received ${buffer.byteLength} bytes mime=${mime} → filename=${filename}`,
    );
    if (buffer.byteLength < 200) {
      return new Response(
        JSON.stringify({ error: "Audio juda qisqa yoki bo'sh" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    const file = await toFile(buffer, filename, { type: mime });

    const result = await openai.audio.transcriptions.create({
      model: STT_MODEL,
      file,
      language: langHint,
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
      return new Response(
        JSON.stringify({
          error: `STT xatosi (${err.status}): ${err.message || "noma'lum"}`,
          status: err.status,
          mime,
          filename,
        }),
        { status: 502, headers: { "content-type": "application/json" } },
      );
    }
    console.error("STT unexpected error", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "STT xatosi",
        mime,
        filename,
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
