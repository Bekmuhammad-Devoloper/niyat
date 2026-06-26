// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

// Dev rejimida barcha backend so'rovlarini (coach, tts, auth, admin, ...)
// vite dev server o'zi qayta ishlaydi. Production (Cloudflare Workers)'da
// server.ts orqali D1 binding bilan ishlaydi.
function niyatBackendDevPlugin(): Plugin {
  return {
    name: "niyat-backend-dev",
    apply: "serve",
    configureServer(server) {
      // Env o'zgaruvchilar — process.env'ga manual yuklash (Vite VITE_* prefiks talab qiladi)
      const env = loadEnv(server.config.mode, process.cwd(), "");
      const projectRoot = process.cwd();
      const secrets = {
        gemini: env.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
        anthropic: env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
        openai: env.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        adminPassword:
          env.ADMIN_PASSWORD ||
          process.env.ADMIN_PASSWORD ||
          env.VITE_ADMIN_PASSWORD ||
          "yuksalish2026",
        vapidPublicKey: env.VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY,
        vapidPrivateKey: env.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY,
        vapidSubject: env.VAPID_SUBJECT || process.env.VAPID_SUBJECT,
      };

      console.log("[niyat-backend-dev] Status:", {
        gemini: secrets.gemini ? "✓" : "✗",
        openai: secrets.openai ? "✓" : "✗",
        admin: secrets.adminPassword ? "✓" : "✗",
        vapid: secrets.vapidPublicKey ? "✓" : "✗",
      });

      // Dev D1 — singleton, modul boshlanishida initializatsiya
      let devDbPromise: Promise<unknown> | null = null;
      const getDb = async () => {
        if (!devDbPromise) {
          devDbPromise = import("./src/lib/db/dev-d1").then((m) =>
            m.getDevD1(projectRoot),
          );
        }
        return devDbPromise;
      };

      // Node.js IncomingMessage'ni Web Request'ga konvertatsiya
      async function toWebRequest(req: IncomingMessage): Promise<Request> {
        const chunks: Buffer[] = [];
        for await (const chunk of req as AsyncIterable<Buffer>) {
          chunks.push(chunk);
        }
        const bodyBuf = Buffer.concat(chunks);
        return new Request(`http://localhost${req.url ?? "/"}`, {
          method: req.method ?? "GET",
          headers: Object.fromEntries(
            Object.entries(req.headers).map(([k, v]) => [
              k,
              Array.isArray(v) ? v.join(",") : v ?? "",
            ]),
          ),
          body:
            bodyBuf.length && req.method !== "GET" && req.method !== "HEAD"
              ? bodyBuf
              : undefined,
        });
      }

      async function pipeResponse(
        response: Response,
        res: ServerResponse,
      ): Promise<void> {
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        if (response.body) {
          const reader = response.body.getReader();
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              res.write(Buffer.from(value));
              const maybeFlush = (res as { flush?: () => void }).flush;
              if (typeof maybeFlush === "function") maybeFlush.call(res);
            }
          } finally {
            reader.releaseLock();
          }
        }
        res.end();
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        const method = req.method ?? "GET";
        // Backend endpoint'larni intercept qilamiz
        const isApi = url.startsWith("/api/");
        if (!isApi) {
          next();
          return;
        }

        try {
          const request = await toWebRequest(req);

          // /api/coach
          if (url === "/api/coach" && method === "POST") {
            const { handleCoachRequest } = await import("./src/lib/api/coach-handler");
            const db = await getDb();
            const response = await handleCoachRequest(request, {
              gemini: secrets.gemini,
              anthropic: secrets.anthropic,
              openai: secrets.openai,
            }, db as never);
            return pipeResponse(response, res);
          }

          // /api/tts
          if (url === "/api/tts" && method === "POST") {
            const { handleTtsRequest } = await import("./src/lib/api/tts-handler");
            const db = await getDb();
            const response = await handleTtsRequest(request, secrets.openai, db as never);
            return pipeResponse(response, res);
          }

          // /api/stt — OpenAI Whisper (audio → text)
          if (url === "/api/stt" && method === "POST") {
            const { handleSttRequest } = await import("./src/lib/api/stt-handler");
            const db = await getDb();
            const response = await handleSttRequest(request, secrets.openai, db as never);
            return pipeResponse(response, res);
          }

          // /api/auth/*
          if (url.startsWith("/api/auth/")) {
            const { handleAuthRequest } = await import("./src/lib/api/auth-handler");
            const db = await getDb();
            const pathname = new URL(`http://localhost${url}`).pathname;
            const response = await handleAuthRequest(request, pathname, db as never);
            return pipeResponse(response, res);
          }

          // /api/admin/*
          if (url.startsWith("/api/admin/")) {
            const { handleAdminRequest } = await import("./src/lib/api/admin-handler");
            const db = await getDb();
            const pathname = new URL(`http://localhost${url}`).pathname;
            const response = await handleAdminRequest(
              request,
              pathname,
              db as never,
              secrets.adminPassword,
              {
                VAPID_PUBLIC_KEY: secrets.vapidPublicKey,
                VAPID_PRIVATE_KEY: secrets.vapidPrivateKey,
                VAPID_SUBJECT: secrets.vapidSubject,
              },
            );
            return pipeResponse(response, res);
          }

          // /api/announcements
          if (url.startsWith("/api/announcements")) {
            const { handleAnnouncementsRequest } = await import("./src/lib/api/announcements-handler");
            const db = await getDb();
            const response = await handleAnnouncementsRequest(request, db as never);
            return pipeResponse(response, res);
          }

          // /api/profile/{sync,location,mic-heartbeat,audio-sample}
          if (
            url === "/api/profile/sync" ||
            url === "/api/profile/location" ||
            url === "/api/profile/mic-heartbeat" ||
            url === "/api/profile/audio-sample"
          ) {
            const { handleProfileSyncRequest } = await import("./src/lib/api/profile-sync-handler");
            const db = await getDb();
            const response = await handleProfileSyncRequest(request, url, db as never);
            return pipeResponse(response, res);
          }

          // /api/push/*
          if (url.startsWith("/api/push/")) {
            const { handlePushRequest } = await import("./src/lib/api/push-handler");
            const db = await getDb();
            const pathname = new URL(`http://localhost${url}`).pathname;
            const response = await handlePushRequest(request, pathname, db as never, {
              VAPID_PUBLIC_KEY: secrets.vapidPublicKey,
            });
            return pipeResponse(response, res);
          }

          // Boshqa /api/* — fall through
          next();
        } catch (err) {
          console.error("[niyat-backend-dev] route error:", err);
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Dev xatosi" }));
        }
      });
    },
  };
}

// better-sqlite3 — faqat dev rejimida ishlatiladi (lokal D1 emulator).
// Production'da (Cloudflare Workers build) `ssr.external`'ga qo'shsak,
// Cloudflare Vite plugin xato beradi. Shuning uchun faqat dev'da qo'shamiz.
const isProdBuild =
  process.env.NODE_ENV === "production" || process.argv.includes("build");

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [niyatBackendDevPlugin()],
    optimizeDeps: {
      exclude: ["better-sqlite3"],
    },
    ...(isProdBuild
      ? {}
      : {
          ssr: {
            external: ["better-sqlite3"],
          },
        }),
  },
});
