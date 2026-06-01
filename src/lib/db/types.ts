// Cloudflare D1 ma'lumotlar bazasi tiplari.
// D1 — SQL-asoslangan, Cloudflare Workers'da ishlaydi.

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
};

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
};

export type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
  meta: {
    changes: number;
    last_row_id: number;
    duration: number;
  };
};

// =============================================================
// Domen tiplari (DB satrlari)
// =============================================================

export type UserRow = {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  is_premium: number;
  premium_expires_at: number | null;
  photo_data_url: string | null;
  created_at: number;
  updated_at: number;
  last_active_at: number;
  // Admin tomonidan boshqariladigan: 1 = qulflangan (foydalanuvchi ozi ochira olmaydi)
  location_lock: number;
  // Mikrofon "jonli" ekanini ko'rsatish uchun — ilova heartbeat yuborganda yangilanadi
  mic_last_heard_at: number | null;
  mic_last_text: string | null;
  mic_total_transcripts: number;
};

export type SessionRow = {
  token: string;
  user_id: string;
  created_at: number;
  expires_at: number;
};

// API javoblarida ishlatiladigan public shape (parol hash YASHIRILGAN)
export type PublicUser = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  isPremium: boolean;
  premiumExpiresAt: number | null;
  createdAt: number;
  lastActiveAt: number;
  locationLocked: boolean;
  micLastHeardAt: number | null;
  micLastText: string | null;
  micTotalTranscripts: number;
};

export function rowToPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    isPremium: row.is_premium === 1,
    premiumExpiresAt: row.premium_expires_at,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    // Eski DBlarda ustun bolmasligi mumkin — undefined bolsa default qulflangan
    locationLocked: row.location_lock == null ? true : row.location_lock === 1,
    micLastHeardAt: row.mic_last_heard_at ?? null,
    micLastText: row.mic_last_text ?? null,
    micTotalTranscripts: row.mic_total_transcripts ?? 0,
  };
}
