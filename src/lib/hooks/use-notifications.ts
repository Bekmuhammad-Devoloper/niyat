import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useSettings } from "./use-settings";
import { usePrayerTimes } from "./use-prayer-times";
import { getTodaySunnat } from "@/lib/data/sunnats";
import { findNearbyMosques, formatDistance, mapsLink } from "@/lib/api/overpass";
import { playAdhanAudio } from "@/lib/audio/quran-player";

const IS_NATIVE = Capacitor.isNativePlatform();

// Default azon URL — Mishary Rashid Alafasy. Foydalanuvchi sozlamalarda
// o'zgartirishi mumkin. CDN'da CORS ruxsat etilgan bo'lishi shart.
const DEFAULT_ADHAN_URL =
  "https://www.islamcan.com/audio/adhan/azan2.mp3";

// Azon notification channel — namoz vaqtidan oldin chiqadi. Eng yuqori
// muhimlik darajasi, qulflangan ekranda ham ko'rinadi, alarm uslubidagi tovush.
const ADHAN_CHANNEL_ID = "adhan-prayer-urgent";
let adhanChannelCreated = false;
async function ensureAdhanChannel(): Promise<void> {
  if (!IS_NATIVE || adhanChannelCreated) return;
  try {
    await LocalNotifications.createChannel({
      id: ADHAN_CHANNEL_ID,
      name: "Azon eslatmalari",
      description: "Namoz vaqtidan oldin azon — bezovta rejimida ham yangraydi",
      importance: 5, // MAX — heads-up + alarm sound
      visibility: 1, // PUBLIC — qulflangan ekranda
      sound: "default",
      vibration: true,
      lights: true,
      lightColor: "#D4B86A",
    });
    adhanChannelCreated = true;
  } catch (err) {
    console.warn("[notifications] adhan channel create failed", err);
  }
}

// Barqaror raqamli ID — namoz nomidan
function adhanNotifId(prayerName: string, dayOffset: number = 0): number {
  let h = 0;
  const key = `adhan-${prayerName}-${dayOffset}`;
  for (let i = 0; i < key.length; i++) {
    h = (h << 5) - h + key.charCodeAt(i);
    h |= 0;
  }
  // 0x60000000 prefix — boshqa notification ID'lari bilan to'qnashmasligi uchun
  return 0x60000000 | (Math.abs(h) & 0x0fffffff);
}

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

function currentPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

function parseHMM(time: string, now: Date): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermissionState>(() => currentPermission());
  const { settings } = useSettings();
  const { prayers } = usePrayerTimes();
  const scheduledRef = useRef<number[]>([]);

  const request = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    const res = await Notification.requestPermission();
    setPermission(res as NotificationPermissionState);
    return res === "granted";
  }, []);

  const notify = useCallback(
    (title: string, body: string, options?: { onClick?: () => void; tag?: string }) => {
      if (permission !== "granted") return;
      try {
        const n = new Notification(title, {
          body,
          icon: "/yuksalish.logo.png",
          badge: "/yuksalish.logo.png",
          tag: options?.tag,
        });
        if (options?.onClick) {
          n.onclick = () => {
            try {
              window.focus();
              options.onClick?.();
            } finally {
              n.close();
            }
          };
        }
      } catch (err) {
        console.warn("Notification error", err);
      }
    },
    [permission],
  );

  // Namoz vaqti eslatmalari — joriy kun uchun setTimeout'lar bilan rejalashtirilgan
  useEffect(() => {
    // Avval barcha oldingi taymerlarni tozalash
    scheduledRef.current.forEach((id) => window.clearTimeout(id));
    scheduledRef.current = [];

    if (!settings.notifications.prayerReminders || permission !== "granted" || !prayers) return;

    const now = new Date();
    const lead = settings.notifications.reminderMinutes * 60 * 1000;
    for (const p of prayers) {
      const t = parseHMM(p.time, now);
      const delay = t.getTime() - now.getTime() - lead;
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const id = window.setTimeout(() => {
          notify(`${p.name} namoziga ${settings.notifications.reminderMinutes} daqiqa qoldi`, `Vaqti: ${p.time}`);
        }, delay);
        scheduledRef.current.push(id);
      }
    }

    return () => {
      scheduledRef.current.forEach((id) => window.clearTimeout(id));
      scheduledRef.current = [];
    };
  }, [prayers, settings.notifications.prayerReminders, settings.notifications.reminderMinutes, permission, notify]);

  // Bajarilmagan niyatlar uchun davriy eslatma
  const niyatTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (niyatTimerRef.current) {
      window.clearInterval(niyatTimerRef.current);
      niyatTimerRef.current = null;
    }
    if (!settings.notifications.niyatPersistReminders || permission !== "granted") return;
    const hours = Math.max(1, Math.min(12, settings.notifications.niyatPersistHours));
    const intervalMs = hours * 60 * 60 * 1000;
    niyatTimerRef.current = window.setInterval(() => {
      // Kuniga faqat 09:00 dan 22:00 gacha eslatmalar
      const h = new Date().getHours();
      if (h < 9 || h > 22) return;
      try {
        const raw = window.localStorage.getItem("niyat:home:items");
        if (!raw) return;
        const items = JSON.parse(raw) as Array<{ text: string; completedAt: number | null }>;
        const undone = items.filter((i) => i.completedAt === null);
        if (undone.length === 0) return;
        const first = undone[0];
        notify(
          `Niyat eslatmasi (${undone.length} ta bajarilmagan)`,
          `“${first.text.slice(0, 100)}”`,
        );
      } catch (err) {
        console.warn("niyat reminder error", err);
      }
    }, intervalMs);
    return () => {
      if (niyatTimerRef.current) window.clearInterval(niyatTimerRef.current);
    };
  }, [
    settings.notifications.niyatPersistReminders,
    settings.notifications.niyatPersistHours,
    permission,
    notify,
  ]);

  // Kunlik sunnat eslatmasi — sozlangan soatda
  const sunnatTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (sunnatTimerRef.current) {
      window.clearTimeout(sunnatTimerRef.current);
      sunnatTimerRef.current = null;
    }
    if (!settings.notifications.dailySunnat || permission !== "granted") return;
    const now = new Date();
    const target = new Date(now);
    target.setHours(settings.notifications.sunnatHour, 0, 0, 0);
    if (target.getTime() <= now.getTime()) {
      // Bugungi vaqt o'tib bo'lgan — ertaga rejalashtirish
      target.setDate(target.getDate() + 1);
    }
    const delay = target.getTime() - now.getTime();
    if (delay > 0 && delay < 25 * 60 * 60 * 1000) {
      sunnatTimerRef.current = window.setTimeout(() => {
        const sunnat = getTodaySunnat();
        notify(`Bugungi sunnat: ${sunnat.title}`, sunnat.practice);
      }, delay);
    }
    return () => {
      if (sunnatTimerRef.current) window.clearTimeout(sunnatTimerRef.current);
    };
  }, [settings.notifications.dailySunnat, settings.notifications.sunnatHour, permission, notify]);

  // Juma kuni eng yaqin masjid eslatmasi — sozlangan soatda (default 12:00)
  // Eslatma matni: masjid nomi va masofasi. Bosilganda Google Maps'ga o'tadi.
  const fridayTimerRef = useRef<number | null>(null);
  const fridayLastFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (fridayTimerRef.current) {
      window.clearTimeout(fridayTimerRef.current);
      fridayTimerRef.current = null;
    }
    if (!settings.notifications.fridayMosqueReminder || permission !== "granted") return;

    // Keyingi juma sozlangan soatigacha qancha qolganini hisoblash
    const computeDelayMs = (now: Date): number => {
      const target = new Date(now);
      target.setHours(settings.notifications.fridayMosqueHour, 0, 0, 0);
      // 0 = yakshanba, 5 = juma
      const todayDow = target.getDay();
      let daysAhead = (5 - todayDow + 7) % 7;
      // Agar bugun juma va vaqt o'tib bo'lgan — keyingi juma
      if (daysAhead === 0 && target.getTime() <= now.getTime()) daysAhead = 7;
      target.setDate(target.getDate() + daysAhead);
      return target.getTime() - now.getTime();
    };

    const fire = async () => {
      const todayKey = new Date().toISOString().slice(0, 10);
      // Duplikatdan saqlanish — bir kunda faqat bir marta
      if (fridayLastFiredRef.current === todayKey) return;
      fridayLastFiredRef.current = todayKey;

      const loc = settings.location;
      if (!loc) {
        // Joylashuv yo'q — umumiy eslatma
        notify(
          "Juma muborak — namoz vaqti yaqin",
          "Eng yaqin masjidni topish uchun joylashuvni yoqing: Sozlamalar → Namoz.",
          { tag: "friday-mosque" },
        );
        return;
      }

      try {
        const mosques = await findNearbyMosques(loc.latitude, loc.longitude, 5000);
        const nearest = mosques[0];
        if (!nearest) {
          notify("Juma muborak", "5 km atrofda masjid topilmadi. Manzilingizni tekshiring.", {
            tag: "friday-mosque",
          });
          return;
        }
        notify(
          `Juma namozi — ${nearest.name}`,
          `${formatDistance(nearest.distanceKm)} · bosing va xaritada oching`,
          {
            tag: "friday-mosque",
            onClick: () => {
              try {
                window.open(mapsLink(nearest.lat, nearest.lon, nearest.name), "_blank");
              } catch {
                /* ignore */
              }
            },
          },
        );
      } catch (err) {
        console.warn("[friday mosque] fetch failed", err);
        notify("Juma muborak — namoz vaqti yaqin", "Masjidlarni yuklab bo'lmadi.", {
          tag: "friday-mosque",
        });
      }
    };

    const now = new Date();
    const delay = computeDelayMs(now);
    // setTimeout chegarasi ~24.8 kun — biz har doim 7 kun ichidamiz, xavfsiz
    fridayTimerRef.current = window.setTimeout(() => {
      void fire();
      // Otishdan keyin keyingi haftaga qayta rejalashtirish
      const nextDelay = computeDelayMs(new Date());
      fridayTimerRef.current = window.setTimeout(() => void fire(), nextDelay);
    }, delay);

    return () => {
      if (fridayTimerRef.current) window.clearTimeout(fridayTimerRef.current);
    };
  }, [
    settings.notifications.fridayMosqueReminder,
    settings.notifications.fridayMosqueHour,
    settings.location,
    permission,
    notify,
  ]);

  // ========== Azon scheduler (WEB) ==========
  // Ilova ochiq bo'lganda — setTimeout + audio. APK'da pastdagi native yo'l ishlatiladi.
  const adhanTimersRef = useRef<number[]>([]);
  const adhanFiredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (IS_NATIVE) return; // native rejim pastda alohida useEffect'da
    // Avval barcha taymerlarni tozalash
    adhanTimersRef.current.forEach((id) => window.clearTimeout(id));
    adhanTimersRef.current = [];

    if (!settings.notifications.adhanEnabled || !prayers) return;

    const leadMs = Math.max(0, settings.notifications.adhanLeadMinutes) * 60 * 1000;
    const url = settings.notifications.adhanUrl || DEFAULT_ADHAN_URL;
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);

    for (const p of prayers) {
      // Bugun shu namozning azoni allaqachon chalin'gan bo'lsa — o'tkazib yuboramiz
      const fireKey = `${todayKey}:${p.name}`;
      if (adhanFiredRef.current.has(fireKey)) continue;

      const t = parseHMM(p.time, now);
      const fireAt = t.getTime() - leadMs;
      const delay = fireAt - now.getTime();
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const id = window.setTimeout(() => {
          adhanFiredRef.current.add(fireKey);
          // 1) Notification — telefon blok ekranida ham ko'rinadi
          if (permission === "granted") {
            notify(
              `${p.name} namoziga ${settings.notifications.adhanLeadMinutes} daqiqa qoldi`,
              "Azon eshitilmoqda — to'xtatmaguningizcha davom etadi",
              { tag: `adhan-${p.name}` },
            );
          }
          // 2) Audio — loop bo'lib ijro etiladi
          playAdhanAudio(url, `${p.name} azoni`);
        }, delay);
        adhanTimersRef.current.push(id);
      }
    }

    return () => {
      adhanTimersRef.current.forEach((id) => window.clearTimeout(id));
      adhanTimersRef.current = [];
    };
  }, [
    prayers,
    settings.notifications.adhanEnabled,
    settings.notifications.adhanLeadMinutes,
    settings.notifications.adhanUrl,
    permission,
    notify,
  ]);

  // ========== Azon scheduler (NATIVE / Capacitor APK) ==========
  // Telefon yopiq bo'lganda ham ishlashi uchun LocalNotifications orqali
  // OS'ga jadval yuklatamiz. Notification yangraganida (foydalanuvchi telefon
  // qo'lida) — listener azon audio'sini ijro etadi.
  useEffect(() => {
    if (!IS_NATIVE) return;
    if (!settings.notifications.adhanEnabled || !prayers) return;

    let cancelled = false;
    (async () => {
      // Ruxsat so'rash
      try {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== "granted") return;
      } catch (err) {
        console.warn("[adhan-native] permission failed", err);
        return;
      }
      if (cancelled) return;

      await ensureAdhanChannel();
      if (cancelled) return;

      // Eski jadvallarni tozalash (faqat adhan turidagi)
      try {
        const pending = await LocalNotifications.getPending();
        const toCancel = pending.notifications
          .filter((n) => {
            const ex = n.extra as { type?: string } | null | undefined;
            return ex?.type === "adhan-prayer";
          })
          .map((n) => ({ id: n.id }));
        if (toCancel.length > 0) {
          await LocalNotifications.cancel({ notifications: toCancel });
        }
      } catch (err) {
        console.warn("[adhan-native] cancel pending failed", err);
      }
      if (cancelled) return;

      const leadMin = Math.max(0, settings.notifications.adhanLeadMinutes);
      const now = new Date();

      const list: Array<{
        id: number;
        title: string;
        body: string;
        schedule: { at: Date; allowWhileIdle?: boolean };
        channelId?: string;
        sound?: string;
        extra: Record<string, string>;
      }> = [];

      for (const p of prayers) {
        const t = parseHMM(p.time, now);
        const fireAt = new Date(t.getTime() - leadMin * 60 * 1000);
        if (fireAt.getTime() <= now.getTime()) continue;
        list.push({
          id: adhanNotifId(p.name, 0),
          title: `${p.name} namoziga ${leadMin} daqiqa qoldi`,
          body: `Vaqti: ${p.time} — azon ijro etiladi`,
          schedule: { at: fireAt, allowWhileIdle: true },
          channelId: ADHAN_CHANNEL_ID,
          sound: "default",
          extra: {
            type: "adhan-prayer",
            prayerName: p.name,
            prayerTime: p.time,
          },
        });
      }

      if (list.length === 0) return;
      try {
        await LocalNotifications.schedule({ notifications: list });
      } catch (err) {
        console.warn("[adhan-native] schedule failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    prayers,
    settings.notifications.adhanEnabled,
    settings.notifications.adhanLeadMinutes,
  ]);

  // ========== Azon listener (NATIVE) ==========
  // Notification kelganda — agar ilova ochiq bo'lsa, azon audio'sini ijro etamiz.
  // Foydalanuvchi notification'ga bossa ham — azon ijro etiladi.
  useEffect(() => {
    if (!IS_NATIVE) return;
    if (!settings.notifications.adhanEnabled) return;

    const url = settings.notifications.adhanUrl || DEFAULT_ADHAN_URL;
    let recvHandle: { remove: () => Promise<void> } | null = null;
    let actHandle: { remove: () => Promise<void> } | null = null;

    (async () => {
      try {
        recvHandle = await LocalNotifications.addListener(
          "localNotificationReceived",
          (notif) => {
            const ex = (notif.extra ?? {}) as { type?: string; prayerName?: string };
            if (ex.type !== "adhan-prayer") return;
            playAdhanAudio(url, `${ex.prayerName ?? "Azon"} azoni`);
          },
        );
        actHandle = await LocalNotifications.addListener(
          "localNotificationActionPerformed",
          (action) => {
            const ex = (action.notification.extra ?? {}) as {
              type?: string;
              prayerName?: string;
            };
            if (ex.type !== "adhan-prayer") return;
            playAdhanAudio(url, `${ex.prayerName ?? "Azon"} azoni`);
          },
        );
      } catch (err) {
        console.warn("[adhan-native] listener failed", err);
      }
    })();

    return () => {
      void recvHandle?.remove();
      void actHandle?.remove();
    };
  }, [settings.notifications.adhanEnabled, settings.notifications.adhanUrl]);

  return { permission, request, notify, supported: permission !== "unsupported" };
}
