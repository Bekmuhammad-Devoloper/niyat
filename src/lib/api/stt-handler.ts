// OpenAI gpt-4o-transcribe bilan audio transkripsiya. Capacitor WebView Web
// Speech API'ni ishonchli qo'llab-quvvatlamasligi sababli, ovozli muloqotda
// MediaRecorder bilan yozib shu endpoint'ga jo'natamiz.
//
// Model tanlash tarixi:
//   - whisper-1: O'zbek tili rasman yo'q. "uz" hint = 400 xatosi. "tr"
//     (turk) mapping bilan ishlaydi-yu, lekin gapni Turkify qilib buzadi
//     (-yapti -> -yor, oʻ -> ö, va h.k.). Voice mode'da AI "tushunmayapti"
//     muammosini keltirib chiqarardi.
//   - gpt-4o-transcribe: 2025-mart OpenAI yangiligi, GPT-4o multilingual
//     backbone. O'zbek tilini Whisper-1'dan ancha yaxshi tushunadi va
//     language="uz" hint'ini qabul qiladi (rasman ro'yxatda yo'q-yu,
//     lekin API qabul qiladi).
//
// Request: multipart/form-data, "audio" maydoni
// Response: { text: string }

import OpenAI, { toFile } from "openai";
import { logAiCall, userIdFromRequest } from "./ai-log";
import type { D1Database } from "../db/types";

const STT_MODEL = "gpt-4o-transcribe";

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

  // Til hint — gpt-4o-transcribe "uz" (o'zbek) hint'ini qabul qiladi.
  // Bo'sh string yoki noma'lum kod kelsa undefined qilamiz va avto-detect.
  const rawLang = ((formData.get("lang") as string | null) ?? "").toLowerCase();
  const langHint: string | undefined = rawLang
    ? rawLang === "uzb"
      ? "uz"
      : rawLang
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
      // Prompt — o'zbek lotin yozuvi, islomiy va kundalik vocabulary,
      // model tarjima qilmaslik va lotin imlosini saqlash uchun.
      // gpt-4o-transcribe prompt'ni style guide sifatida ishlatadi.
      prompt:
        "Niyat AI hayot murabbiy ilovasi. Foydalanuvchi o'zbek tilida " +
        "lotin yozuvida gapiradi: niyat, maqsad, namoz, ro'za, sadaqa, " +
        "Qur'on, sura, oyat, ibodat, oila, ota-ona, farzand, mehr, " +
        "shukr, tavba, do'st, Instagram, telefon, alarm, qo'ng'iroq, " +
        "soat, daqiqa, ertaga, kecha, bugun, ozgina, qo'shimcha, " +
        "ko'paytirish, yengillik, bo'lyapti, qilyapman, o'qiyapman. " +
        "Ismlar: Bekmuhammad, Olloh, Muhammad sollallohu alayhi va sallam, " +
        "Abu Bakr, Umar, Usmon, Ali, Oysha, Fotima. " +
        "Imlo: oʻ, gʻ, sh, ch, ng. Turkcha emas, o'zbekcha yoz.",
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
      console.error(`[stt] ${STT_MODEL} error`, err.status, err.message);
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
