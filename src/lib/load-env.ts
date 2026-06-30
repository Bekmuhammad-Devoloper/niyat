// Oddiy .env loader — dotenv paketisiz. Node.js'da ishlaydi (Cloudflare
// Workers'da silent no-op). Server ishga tushganda .env faylni o'qib
// process.env'ga yuklaydi.
//
// Bir nechta manzilni tekshiramiz — systemd unit'ining WorkingDirectory'si
// noma'lum bo'lishi mumkin, shu sabab ham nisbiy, ham GCE'dagi to'liq
// yo'lni urinib ko'ramiz.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

export function loadDotEnvIfPresent(): void {
  if (loaded) return;
  loaded = true;
  if (typeof process === "undefined" || !process?.env) return;

  const candidates: string[] = [];

  // 1) Joriy ishchi katalog
  try {
    candidates.push(resolve(process.cwd(), ".env"));
    candidates.push(resolve(process.cwd(), "..", ".env"));
  } catch {}

  // 2) Script faylining katalogidan yuqoriga qidirish
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(here, ".env"));
    candidates.push(resolve(here, "..", ".env"));
    candidates.push(resolve(here, "..", "..", ".env"));
    candidates.push(resolve(here, "..", "..", "..", ".env"));
    candidates.push(resolve(here, "..", "..", "..", "..", ".env"));
  } catch {}

  // 3) Production server'dagi to'liq yo'l — deploy workflow shu yerga yozadi
  candidates.push("/home/bekmuhammad_devoloper/niyat/.env");

  // Dublikatlarni olib tashlash
  const seen = new Set<string>();
  const unique = candidates.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  console.log("[env] cwd:", process.cwd());
  console.log("[env] checking paths:", unique);

  for (const path of unique) {
    try {
      if (!existsSync(path)) continue;
      const content = readFileSync(path, "utf8");
      let count = 0;
      const keysLoaded: string[] = [];
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined || process.env[key] === "") {
          process.env[key] = value;
          keysLoaded.push(key);
          count++;
        }
      }
      console.log(
        `[env] loaded ${count} key(s) from ${path}: ${keysLoaded.join(", ") || "(none new)"}`,
      );
      // Birinchi muvaffaqiyatli fayldan keyin to'xtamaymiz — keyingilari ham
      // qo'shimcha kalit qo'shishi mumkin
    } catch (err) {
      console.warn(`[env] failed to read ${path}:`, err);
    }
  }

  console.log("[env] final state:", {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "✓ set" : "✗ MISSING",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "✓ set" : "✗ MISSING",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "✓ set" : "✗ MISSING",
  });
}
