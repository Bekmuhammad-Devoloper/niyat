// Sahihi Buxoriy hadis matnlarini AI orqali zamonaviy va sodda o'zbek
// tilida qayta yozish. Natija localStorage'da sunnat ID bo'yicha
// cache'lanadi — har sunnat faqat bir marta tarjima qilinadi.

import { useCallback, useEffect, useState } from "react";

const CACHE_PREFIX = "niyat:sunnat:simplified:";

type SunnatLike = {
  id: string;
  title: string;
  context: string;
};

function readCache(id: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CACHE_PREFIX + id);
  } catch {
    return null;
  }
}

function writeCache(id: string, text: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + id, text);
  } catch {
    /* quota exceeded — jim o'tish */
  }
}

export function useSunnatSimplify(sunnatId: string | null) {
  const [simplified, setSimplified] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sunnat o'zgarganda cache'dan o'qish
  useEffect(() => {
    setError(null);
    if (!sunnatId) {
      setSimplified(null);
      return;
    }
    setSimplified(readCache(sunnatId));
  }, [sunnatId]);

  const simplify = useCallback(async (sunnat: SunnatLike) => {
    const cached = readCache(sunnat.id);
    if (cached) {
      setSimplified(cached);
      return;
    }

    setIsLoading(true);
    setError(null);
    const userPrompt = `Quyidagi hadis matnini zamonaviy va sodda o'zbek tilida (latin alifbosi), 3-5 jumla bilan tushunarli qilib qayta yoz. Hadis mazmunini buzma, lekin arxaik so'zlarni va eski grammatika qoliplarini almashtir. Sarlavhani takrorlama, faqat tushunarli matnni yoz. Markdown ishlatma.

Sarlavha: ${sunnat.title}

Asl matn:
${sunnat.context}`;

    try {
      const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
      const res = await fetch(`${apiBase}/api/coach`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) {
        if (res.status === 503) {
          throw new Error("AI sozlanmagan (API kalit yo'q)");
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { reply?: string; error?: string };
      if (data.error || !data.reply) {
        throw new Error(data.error ?? "Bo'sh javob");
      }
      const text = data.reply.trim();
      setSimplified(text);
      writeCache(sunnat.id, text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Xatolik";
      setError(msg);
      console.warn("[simplifySunnat]", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    if (!sunnatId) return;
    try {
      window.localStorage.removeItem(CACHE_PREFIX + sunnatId);
    } catch {
      /* ignore */
    }
    setSimplified(null);
    setError(null);
  }, [sunnatId]);

  return { simplified, isLoading, error, simplify, clear };
}
