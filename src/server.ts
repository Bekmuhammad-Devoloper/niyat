import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleCoachRequest } from "./lib/api/coach-handler";
import { handleTtsRequest } from "./lib/api/tts-handler";
import { handleSttRequest } from "./lib/api/stt-handler";
import { handleAuthRequest } from "./lib/api/auth-handler";
import { handleAdminRequest } from "./lib/api/admin-handler";
import { handleAnnouncementsRequest } from "./lib/api/announcements-handler";
import { handleProfileSyncRequest } from "./lib/api/profile-sync-handler";
import { handlePushRequest } from "./lib/api/push-handler";
import type { D1Database } from "./lib/db/types";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type EnvWithSecrets = {
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ADMIN_PASSWORD?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  DB?: D1Database;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// Capacitor mobile APK CORS — har bir /api/* javobiga ushbu sarlavhalarni
// qo'shamiz. APK Origin sifatida http://localhost yoki capacitor://localhost
// yuboradi va CORS bo'lmasa fetch failed bilan to'xtaydi.
function addCorsHeaders(response: Response, request: Request): Response {
  const origin = request.headers.get("origin") ?? "*";
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", origin);
  newHeaders.set("Access-Control-Allow-Credentials", "true");
  newHeaders.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  newHeaders.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Admin-Password",
  );
  newHeaders.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

function corsPreflightResponse(request: Request): Response {
  return addCorsHeaders(new Response(null, { status: 204 }), request);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // CORS preflight — /api/* uchun
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        return corsPreflightResponse(request);
      }

      // Niyat AI Murabbiy API — TanStack handler'idan oldin interceptsiya.
      if (url.pathname === "/api/coach") {
        const secrets = env as EnvWithSecrets | undefined;
        return addCorsHeaders(
          await handleCoachRequest(
            request,
            {
              gemini: secrets?.GEMINI_API_KEY,
              anthropic: secrets?.ANTHROPIC_API_KEY,
              openai: secrets?.OPENAI_API_KEY,
            },
            secrets?.DB,
          ),
          request,
        );
      }
      // OpenAI TTS — Murabbiy uchun tabiiy ovoz
      if (url.pathname === "/api/tts") {
        const secrets = env as EnvWithSecrets | undefined;
        return addCorsHeaders(
          await handleTtsRequest(request, secrets?.OPENAI_API_KEY, secrets?.DB),
          request,
        );
      }
      // OpenAI Whisper STT — audio'dan matn (voice mode)
      if (url.pathname === "/api/stt") {
        const secrets = env as EnvWithSecrets | undefined;
        return addCorsHeaders(
          await handleSttRequest(request, secrets?.OPENAI_API_KEY, secrets?.DB),
          request,
        );
      }
      // Auth — register, login, me
      if (url.pathname.startsWith("/api/auth/")) {
        const secrets = env as EnvWithSecrets | undefined;
        return addCorsHeaders(
          await handleAuthRequest(request, url.pathname, secrets?.DB),
          request,
        );
      }
      // Public e'lonlar (admin tomonidan yuborilgan)
      if (url.pathname === "/api/announcements") {
        const secrets = env as EnvWithSecrets | undefined;
        return addCorsHeaders(
          await handleAnnouncementsRequest(request, secrets?.DB),
          request,
        );
      }
      // Profil sinxron — foydalanuvchi auth bilan
      if (
        url.pathname === "/api/profile/sync" ||
        url.pathname === "/api/profile/location" ||
        url.pathname === "/api/profile/mic-heartbeat" ||
        url.pathname === "/api/profile/audio-sample"
      ) {
        const secrets = env as EnvWithSecrets | undefined;
        return addCorsHeaders(
          await handleProfileSyncRequest(request, url.pathname, secrets?.DB),
          request,
        );
      }
      // Push notifications
      if (url.pathname.startsWith("/api/push/")) {
        const secrets = env as EnvWithSecrets | undefined;
        return addCorsHeaders(
          await handlePushRequest(request, url.pathname, secrets?.DB, {
            VAPID_PUBLIC_KEY: secrets?.VAPID_PUBLIC_KEY,
          }),
          request,
        );
      }
      // Admin — foydalanuvchilar, statistika, premium
      if (url.pathname.startsWith("/api/admin/")) {
        const secrets = env as EnvWithSecrets | undefined;
        return addCorsHeaders(
          await handleAdminRequest(
            request,
            url.pathname,
            secrets?.DB,
            secrets?.ADMIN_PASSWORD,
            {
              VAPID_PUBLIC_KEY: secrets?.VAPID_PUBLIC_KEY,
              VAPID_PRIVATE_KEY: secrets?.VAPID_PRIVATE_KEY,
              VAPID_SUBJECT: secrets?.VAPID_SUBJECT,
            },
          ),
          request,
        );
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
