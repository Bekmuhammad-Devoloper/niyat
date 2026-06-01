// Vite dev plugin uchun D1 mock — better-sqlite3 ustida ishlaydi.
// Cloudflare Workers'ning D1Database interface'ini taqlid qiladi, lekin
// Node.js Process'da. Production'da haqiqiy D1 ishlatiladi.
//
// Ma'lumotlar `.dev-db/niyat.sqlite` faylida saqlanadi (gitignore'da).

import Database from "better-sqlite3";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { D1Database, D1PreparedStatement, D1Result } from "./types";

let instance: D1Database | null = null;

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function applyMigrations(db: Database.Database, migrationsDir: string): void {
  if (!existsSync(migrationsDir)) return;
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  // Migrations'ni har safar idempotent qo'llaymiz (CREATE IF NOT EXISTS bor)
  for (const file of files) {
    try {
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      db.exec(sql);
    } catch (err) {
      console.warn(`[dev-d1] migration ${file} failed:`, err);
    }
  }
}

// SQLite better-sqlite3 obyektini D1Database interfeysiga mos qilib o'rash.
function wrapDb(sqlite: Database.Database): D1Database {
  return {
    prepare(query: string): D1PreparedStatement {
      // Bind argumentlarini saqlash uchun closure
      let boundValues: unknown[] = [];
      const stmt = sqlite.prepare(query);
      const wrapper: D1PreparedStatement = {
        bind(...values: unknown[]) {
          boundValues = values;
          return wrapper;
        },
        async first<T = unknown>(_column?: string): Promise<T | null> {
          const row = stmt.get(...boundValues);
          return (row as T) ?? null;
        },
        async run(): Promise<D1Result> {
          const info = stmt.run(...boundValues);
          return {
            success: true,
            meta: {
              changes: Number(info.changes ?? 0),
              last_row_id: Number(info.lastInsertRowid ?? 0),
              duration: 0,
            },
          };
        },
        async all<T = unknown>(): Promise<D1Result<T>> {
          const rows = stmt.all(...boundValues) as T[];
          return {
            results: rows,
            success: true,
            meta: {
              changes: 0,
              last_row_id: 0,
              duration: 0,
            },
          };
        },
      };
      return wrapper;
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const s of statements) {
        results.push(await s.all<T>());
      }
      return results;
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
  };
}

export function getDevD1(projectRoot: string): D1Database {
  if (instance) return instance;
  const dbDir = join(projectRoot, ".dev-db");
  ensureDir(dbDir);
  const dbPath = join(dbDir, "niyat.sqlite");
  console.log(`[dev-d1] SQLite: ${dbPath}`);
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  applyMigrations(sqlite, join(projectRoot, "migrations"));
  instance = wrapDb(sqlite);
  return instance;
}
