// Oddiy .env loader — dotenv paketisiz. Node.js'da ishlaydi (Cloudflare
// Workers'da silent no-op). Server ishga tushganda .env faylni o'qib
// process.env'ga yuklaydi. Foydalanuvchi systemd unit'ida EnvironmentFile
// belgilanmagan bo'lsa ham server kalitlarni topadi.
//
// Format:
//   KEY=value
//   KEY="qiymat probelli"
//   # izoh
//
// Mavjud env qiymatlarni almashtirmaydi — agar systemd uni allaqachon
// o'rnatgan bo'lsa, .env qiymati e'tibor berilmaydi.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

export function loadDotEnvIfPresent(): void {
  if (loaded) return;
  loaded = true;
  if (typeof process === "undefined" || !process?.env) return;

  // .env qaerda bo'lishi mumkin: ishchi katalog (production yoki dev)
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ];

  for (const path of candidates) {
    try {
      if (!existsSync(path)) continue;
      const content = readFileSync(path, "utf8");
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
        // Mavjud env qiymat ustun — systemd qo'ygan qiymatga tegmaymiz
        if (process.env[key] === undefined || process.env[key] === "") {
          process.env[key] = value;
        }
      }
      console.log(`[env] loaded from ${path}`);
      break;
    } catch (err) {
      console.warn(`[env] failed to read ${path}:`, err);
    }
  }
}
