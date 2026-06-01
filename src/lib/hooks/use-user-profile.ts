import { useMemo } from "react";
import { useLocalState } from "@/lib/use-local-state";

export type UserProfile = {
  firstName: string;
  lastName: string;
  phone: string; // +998xxxxxxxxx format
  phoneVerified: boolean;
  onboarded: boolean;
  isPremium: boolean; // Pro obuna (doimiy, pul to'langan)
  // Sovg'a sifatida olingan premium — daraja yutuqlari uchun.
  // Timestamp millisekundlarda. Null bo'lsa — sovg'a yo'q.
  premiumExpiresAt?: number | null;
  // Qaysi daraja sovg'alari allaqachon olingan (qayta bermaslik uchun)
  claimedLevelRewards?: number[];
  photoDataUrl?: string;
  // Lokal auth — MVP'da localStorage'da saqlanadi.
  passwordHash: string;
  loggedIn: boolean;
  // Admin tomonidan boshqariladi — server profile-sync javobi yangilab turadi.
  // true = foydalanuvchi joylashuvni ozi ochira olmaydi (juma masjid + real namoz
  // vaqtlari uchun majburiy). Default true: yangi foydalanuvchilar uchun qulflangan.
  locationLocked: boolean;
};

const DEFAULT_PROFILE: UserProfile = {
  firstName: "do'st",
  lastName: "",
  phone: "",
  phoneVerified: false,
  onboarded: false,
  isPremium: false,
  premiumExpiresAt: null,
  claimedLevelRewards: [],
  passwordHash: "",
  loggedIn: false,
  locationLocked: true,
};

// Premium aktivmi — doimiy yoki sovg'a holatida qolgan vaqt bor bo'lsa.
export function isPremiumActive(profile: UserProfile, now: number = Date.now()): boolean {
  if (profile.isPremium) return true;
  if (profile.premiumExpiresAt && profile.premiumExpiresAt > now) return true;
  return false;
}

// Sovg'a premium qancha kun qolgan
export function premiumDaysLeft(profile: UserProfile, now: number = Date.now()): number | null {
  if (profile.isPremium) return null; // doimiy
  if (!profile.premiumExpiresAt || profile.premiumExpiresAt <= now) return null;
  return Math.ceil((profile.premiumExpiresAt - now) / (24 * 60 * 60 * 1000));
}

export function useUserProfile() {
  const [stored, setProfile] = useLocalState<UserProfile>(
    "niyat:user:profile",
    DEFAULT_PROFILE,
  );
  // Eski localStorage formatlarini xavfsiz qilish uchun default'lar bilan
  // birlashtiramiz. Bu yangi maydonlar (passwordHash, loggedIn) qo'shilganda
  // eski foydalanuvchilarda undefined bo'lib qolmasligi uchun.
  const profile = useMemo<UserProfile>(
    () => ({ ...DEFAULT_PROFILE, ...stored }),
    [stored],
  );
  return { profile, setProfile };
}

// Parolni SHA-256 bilan hashlash — Web Crypto API bilan.
// MVP'da localStorage saqlash uchun yetarli; backend kelganda server tomonda
// bcrypt/argon2 ishlatamiz.
export async function hashPassword(password: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // SSR yoki eski brauzer fallback — bu xavfsiz emas, lekin MVP uchun OK
    return `plain:${password}`;
  }
  const data = new TextEncoder().encode(`niyat-salt:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const candidate = await hashPassword(password);
  return candidate === storedHash;
}

// Telefon raqamini formatlash: "+998 90 123 45 67"
export function formatPhone(raw: string | undefined | null): string {
  if (!raw) return "";
  const clean = raw.replace(/\D/g, "");
  if (clean.length === 0) return "";
  // 998 prefix
  if (clean.startsWith("998")) {
    const rest = clean.slice(3);
    const a = rest.slice(0, 2);
    const b = rest.slice(2, 5);
    const c = rest.slice(5, 7);
    const d = rest.slice(7, 9);
    let result = "+998";
    if (a) result += " " + a;
    if (b) result += " " + b;
    if (c) result += " " + c;
    if (d) result += " " + d;
    return result;
  }
  return "+" + clean;
}

// Toza E.164 format ("+998901234567")
export function cleanPhone(raw: string | undefined | null): string {
  if (!raw) return "";
  const clean = raw.replace(/\D/g, "");
  if (clean.startsWith("998") && clean.length === 12) return "+" + clean;
  if (clean.length === 9) return "+998" + clean; // foydalanuvchi 998 yozmagan
  return "+" + clean;
}
