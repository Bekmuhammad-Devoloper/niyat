// Niyat AI Murabbiy backend handler — Multi-provider.
// Provider tartibi: Gemini (bepul 1500/kun) > Anthropic > OpenAI
// Gemini default chunki bepul tier eng generous va o'zbek tilini yaxshi biladi.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NIYAT_SYSTEM_PROMPT, buildUserContextLine } from "./coach-system-prompt";
import { AI_PERSONALITIES, type AIPersonalityKey } from "../settings";
import { logAiCall, userIdFromRequest } from "./ai-log";
import type { D1Database } from "../db/types";

export type CoachKeys = {
  gemini?: string;
  anthropic?: string;
  openai?: string;
};

export type CoachRequestBody = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  userContext?: { firstName: string; niyat?: string };
  personality?: AIPersonalityKey;
  stream?: boolean;
};

const ANTHROPIC_MODEL = "claude-opus-4-7";
const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_MODEL = "gemini-2.0-flash"; // bepul tier, eng tez, o'zbek tili yaxshi
// Coach javobi qisqa bo'lishi kerak — 1-5 jumla. 400 token ~ 300 so'z, yetarli.
const MAX_TOKENS = 400;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function buildSystemPrompt(personalityKey?: AIPersonalityKey): string {
  if (!personalityKey || personalityKey === "balanced") return NIYAT_SYSTEM_PROMPT;
  const p = AI_PERSONALITIES.find((x) => x.key === personalityKey);
  return p ? NIYAT_SYSTEM_PROMPT + p.systemSuffix : NIYAT_SYSTEM_PROMPT;
}

type CleanMessage = { role: "user" | "assistant"; content: string };

function prepareMessages(body: CoachRequestBody): CleanMessage[] | { error: string } {
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { error: "messages array required" };
  }
  const cleaned: CleanMessage[] = body.messages
    .filter(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (cleaned.length === 0) {
    return { error: "No valid messages" };
  }
  // Birinchi user xabariga foydalanuvchi kontekstini qo'shamiz
  if (body.userContext) {
    const ctxLine = buildUserContextLine(body.userContext);
    const firstUserIdx = cleaned.findIndex((m) => m.role === "user");
    if (firstUserIdx >= 0) {
      cleaned[firstUserIdx] = {
        role: "user",
        content: `${ctxLine}\n\n${cleaned[firstUserIdx].content}`,
      };
    }
  }
  return cleaned;
}

export async function handleCoachRequest(
  request: Request,
  keys: CoachKeys,
  db?: D1Database,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  let body: CoachRequestBody;
  try {
    body = (await request.json()) as CoachRequestBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
  }

  const prepared = prepareMessages(body);
  if ("error" in prepared) {
    return jsonResponse({ error: prepared.error }, { status: 400 });
  }
  const messages = prepared;
  const systemText = buildSystemPrompt(body.personality);

  // Provider zanjiri: Gemini > OpenAI. Birinchisi xato bersa (rate limit,
  // server overloaded, quota tugagan) — keyingisiga avtomatik o'tadi. Hech
  // bittasi ishlamasa — oxirgi xatoni qaytaramiz.
  // Anthropic Claude'dan voz kechdik (foydalanuvchi qarori, 2026-06).
  const chain = buildProviderChain(keys);
  if (chain.length === 0) {
    return jsonResponse(
      {
        error: "AI API kaliti sozlanmagan",
        hint: "Dev: .env yarating va GEMINI_API_KEY=... yoki OPENAI_API_KEY=sk-... qo'shing.",
      },
      { status: 503 },
    );
  }

  const userId = await userIdFromRequest(request, db);
  return body.stream
    ? streamWithFallback(chain, systemText, messages, db, userId)
    : jsonWithFallback(chain, systemText, messages, db, userId);
}

// =========================================================
// Provider zanjiri va fallback logikasi
// =========================================================

type ProviderId = "gemini" | "anthropic" | "openai";
type ProviderEntry = { id: ProviderId; key: string };

function buildProviderChain(keys: CoachKeys): ProviderEntry[] {
  const chain: ProviderEntry[] = [];
  if (keys.gemini) chain.push({ id: "gemini", key: keys.gemini });
  if (keys.openai) chain.push({ id: "openai", key: keys.openai });
  // Anthropic provider'i kodda saqlangan (CoachKeys.anthropic, anthropic
  // handler'lar) — kelajakda tiklanish uchun. Lekin zanjirga kiritmaymiz.
  return chain;
}

// HTTP status — keyingi provider'ga o'tishga arzigulik xato?
// 429 (rate limit), 5xx (server muammosi), quota tugashlari — fallback qilamiz.
// 4xx (badRequest, auth) — fallback yo'q, foydalanuvchiga ko'rsatamiz.
function isFallbackStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function isFallbackError(err: unknown): boolean {
  if (err instanceof Anthropic.RateLimitError) return true;
  if (err instanceof Anthropic.APIError && err.status && err.status >= 500) return true;
  if (err instanceof OpenAI.APIError && err.status && (err.status === 429 || err.status >= 500))
    return true;
  if (
    err instanceof Error &&
    /429|RATE_LIMIT|quota|unavailable|overloaded|fetch failed/i.test(err.message)
  )
    return true;
  return false;
}

async function callProviderJSON(
  entry: ProviderEntry,
  systemText: string,
  messages: CleanMessage[],
): Promise<Response> {
  if (entry.id === "gemini") return handleGeminiJSON(entry.key, systemText, messages);
  if (entry.id === "anthropic") return handleAnthropicJSON(entry.key, systemText, messages);
  return handleOpenAIJSON(entry.key, systemText, messages);
}

async function jsonWithFallback(
  chain: ProviderEntry[],
  systemText: string,
  messages: CleanMessage[],
  db?: D1Database,
  userId?: string | null,
): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    const resp = await callProviderJSON(entry, systemText, messages);
    if (resp.ok) {
      // Log AI call (best-effort, async fire-and-forget)
      try {
        const cloned = resp.clone();
        const data = (await cloned.json()) as {
          provider?: string;
          usage?: { inputTokens?: number; outputTokens?: number };
        };
        await logAiCall(db, {
          userId,
          provider: data.provider ?? entry.id,
          endpoint: "coach",
          inputTokens: data.usage?.inputTokens ?? 0,
          outputTokens: data.usage?.outputTokens ?? 0,
          status: 200,
        });
      } catch {
        /* logging xato — asosiy javobni qaytaramiz */
      }
      return resp;
    }
    lastResponse = resp;
    const hasNext = i < chain.length - 1;
    if (hasNext && isFallbackStatus(resp.status)) {
      console.warn(
        `[coach] ${entry.id} returned ${resp.status}, falling back to ${chain[i + 1].id}`,
      );
      continue;
    }
    return resp;
  }
  return lastResponse ?? jsonResponse({ error: "Barcha provayderlar ishlamadi" }, { status: 502 });
}

// Streaming uchun — har provider'da delta callback orqali matn yuboriladi.
// Birinchi delta yuborilgandan keyin provider'ni almashtirish mumkin emas
// (mijozga matn allaqachon yuborilgan). Shu sabab xato birinchi delta'gacha
// bo'lsa — keyingisiga o'tamiz; aks holda joriy provider'ni tugatamiz.
type StreamCallbacks = {
  onDelta: (text: string) => void;
  onDone: (info: { provider: ProviderId; usage?: { inputTokens: number; outputTokens: number } }) => void;
};

async function streamFromProvider(
  entry: ProviderEntry,
  systemText: string,
  messages: CleanMessage[],
  cb: StreamCallbacks,
): Promise<void> {
  if (entry.id === "gemini") return streamGemini(entry.key, systemText, messages, cb);
  if (entry.id === "anthropic") return streamAnthropic(entry.key, systemText, messages, cb);
  return streamOpenAI(entry.key, systemText, messages, cb);
}

async function streamWithFallback(
  chain: ProviderEntry[],
  systemText: string,
  messages: CleanMessage[],
  db?: D1Database,
  userId?: string | null,
): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      let committed = false; // Birinchi delta yuborilganmi?
      let lastError: unknown = null;

      for (let i = 0; i < chain.length; i++) {
        const entry = chain[i];
        try {
          await streamFromProvider(entry, systemText, messages, {
            onDelta: (text) => {
              committed = true;
              send({ type: "delta", text });
            },
            onDone: (info) => {
              send({ type: "done", ...info });
              // Log AI call (fire-and-forget)
              logAiCall(db, {
                userId,
                provider: info.provider,
                endpoint: "coach",
                inputTokens: info.usage?.inputTokens ?? 0,
                outputTokens: info.usage?.outputTokens ?? 0,
                status: 200,
              }).catch(() => undefined);
            },
          });
          controller.close();
          return;
        } catch (err) {
          lastError = err;
          const hasNext = i < chain.length - 1;
          // Joriy provider'ga matn yuborilgan — keyingisiga o'tib bo'lmaydi
          if (committed) {
            console.error(`[coach] ${entry.id} stream crashed mid-response`, err);
            send({
              type: "error",
              error: err instanceof Error ? err.message : "stream-error",
            });
            controller.close();
            return;
          }
          if (hasNext && isFallbackError(err)) {
            console.warn(
              `[coach] ${entry.id} streaming failed, falling back to ${chain[i + 1].id}:`,
              err instanceof Error ? err.message : err,
            );
            continue;
          }
          send({
            type: "error",
            error: err instanceof Error ? err.message : "stream-error",
          });
          controller.close();
          return;
        }
      }

      // Hech qaysisi ishlamadi
      send({
        type: "error",
        error: lastError instanceof Error ? lastError.message : "all-providers-failed",
      });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

// =========================================================
// Google Gemini
// =========================================================

// Gemini chat history birinchi xabarni 'user' role'da kutadi. Agar mijoz
// suhbatdan oldin coach welcome xabari bo'lsa, history "model" bilan
// boshlanadi va Gemini xato beradi. Birinchi user xabarigacha bo'lgan
// hamma narsani tashlaymiz.
function normalizeGeminiHistory(messages: CleanMessage[]): CleanMessage[] {
  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  if (firstUserIdx < 0) return [];
  return messages.slice(firstUserIdx);
}

async function handleGeminiJSON(
  apiKey: string,
  systemText: string,
  messages: CleanMessage[],
): Promise<Response> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemText,
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.8,
    },
  });

  // Gemini history formatiga aylantirish — history birinchi xabarni 'user'
  // role'da kutadi (welcome coach xabari bilan boshlangan suhbatlarda muhim)
  const normalized = normalizeGeminiHistory(messages);
  if (normalized.length === 0) {
    return jsonResponse({ error: "User xabari topilmadi" }, { status: 400 });
  }
  const history = normalized.slice(0, -1).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
  const lastUser = normalized[normalized.length - 1];

  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastUser.content);
    const reply = result.response.text();
    return jsonResponse({
      reply,
      provider: "gemini",
      usage: {
        inputTokens: result.response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
      },
    });
  } catch (err) {
    return handleProviderError(err, "gemini");
  }
}

async function streamGemini(
  apiKey: string,
  systemText: string,
  messages: CleanMessage[],
  cb: StreamCallbacks,
): Promise<void> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemText,
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.8,
    },
  });

  // Gemini history birinchi xabarni 'user'da kutadi
  const normalized = normalizeGeminiHistory(messages);
  if (normalized.length === 0) {
    throw new Error("User xabari topilmadi");
  }
  const history = normalized.slice(0, -1).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
  const lastUser = normalized[normalized.length - 1];

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastUser.content);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) cb.onDelta(text);
  }
  const final = await result.response;
  cb.onDone({
    provider: "gemini",
    usage: {
      inputTokens: final.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: final.usageMetadata?.candidatesTokenCount ?? 0,
    },
  });
}

// =========================================================
// Anthropic Claude
// =========================================================

function pickAnthropicText(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

async function handleAnthropicJSON(
  apiKey: string,
  systemText: string,
  messages: CleanMessage[],
): Promise<Response> {
  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
    });
    return jsonResponse({
      reply: pickAnthropicText(response.content),
      provider: "anthropic",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (err) {
    return handleProviderError(err, "anthropic");
  }
}

async function streamAnthropic(
  apiKey: string,
  systemText: string,
  messages: CleanMessage[],
  cb: StreamCallbacks,
): Promise<void> {
  const client = new Anthropic({ apiKey });
  const apiStream = await client.messages.stream({
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
    messages,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
  });
  for await (const event of apiStream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      cb.onDelta(event.delta.text);
    }
  }
  const final = await apiStream.finalMessage();
  cb.onDone({
    provider: "anthropic",
    usage: {
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    },
  });
}

// =========================================================
// OpenAI
// =========================================================

async function handleOpenAIJSON(
  apiKey: string,
  systemText: string,
  messages: CleanMessage[],
): Promise<Response> {
  const client = new OpenAI({ apiKey });
  try {
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: systemText },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    const reply = response.choices[0]?.message?.content ?? "";
    return jsonResponse({
      reply,
      provider: "openai",
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    });
  } catch (err) {
    return handleProviderError(err, "openai");
  }
}

async function streamOpenAI(
  apiKey: string,
  systemText: string,
  messages: CleanMessage[],
  cb: StreamCallbacks,
): Promise<void> {
  const client = new OpenAI({ apiKey });
  const apiStream = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: MAX_TOKENS,
    stream: true,
    messages: [
      { role: "system", content: systemText },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  });
  for await (const chunk of apiStream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) cb.onDelta(delta);
  }
  cb.onDone({ provider: "openai" });
}

// =========================================================
// Provider xato handlerlari
// =========================================================

function handleProviderError(
  err: unknown,
  provider: "anthropic" | "openai" | "gemini",
): Response {
  if (err instanceof Anthropic.RateLimitError || (err instanceof OpenAI.APIError && err.status === 429)) {
    return jsonResponse(
      { error: "Hozir ko'p so'rov keldi, biroz kutib turing." },
      { status: 429 },
    );
  }
  // Gemini xato matnida "RATE_LIMIT" yoki 429 bo'lishi mumkin
  if (provider === "gemini" && err instanceof Error && /429|RATE_LIMIT|quota/i.test(err.message)) {
    return jsonResponse(
      { error: "Bepul Gemini limit tugadi (1500/kun). Ertaga qaytadan urinib ko'ring." },
      { status: 429 },
    );
  }
  if (err instanceof Anthropic.APIError || err instanceof OpenAI.APIError) {
    console.error(`${provider} API error`, (err as { status?: number }).status, err.message);
    return jsonResponse({ error: "AI bilan aloqada xatolik." }, { status: 502 });
  }
  console.error(`${provider} unexpected error`, err);
  return jsonResponse({ error: "AI bilan aloqada xatolik." }, { status: 502 });
}
