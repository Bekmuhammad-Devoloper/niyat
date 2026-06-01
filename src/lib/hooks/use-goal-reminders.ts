// Reja (maqsad) vaqti kelganda eslatma:
//
// Web / brauzer:
//   1. Vaqt kelgach — browser notification + setTimeout
//   2. X daq keyin "Bajardim" bosilmasa — ayol ovozida TTS eslatma
//   ⚠️ Faqat ilova ochiq turganda ishlaydi
//
// Capacitor APK (Android):
//   1. @capacitor/local-notifications orqali Android system'iga
//      notification scheduling beriladi — ilova yopiq bo'lsa ham chiqadi
//   2. Personalizatsiya: title + body matnda foydalanuvchi ismi va reja
//   3. Notification chiqishi bilan default Android ringtone yangraydi
//   ✅ Ilova yopiq, telefon qulflangan holatda ham ishlaydi

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useGoals, isCompletedToday, shouldShowToday } from "./use-goals";
import { useUserProfile } from "./use-user-profile";
import { useSettings } from "./use-settings";
import { useCoachTTS } from "./use-coach-tts";
import type { Goal } from "@/lib/niyat-data";

const IS_NATIVE = Capacitor.isNativePlatform();

// Android notification channel ID — bu kanal max importance va alarm uslubida
// sozlanadi, bezovta rejimida ham yangrashga harakat qiladi.
const REMINDER_CHANNEL_ID = "goal-reminders-urgent";

// Bir martagina channel yaratish — modul boshlanishida
let channelCreated = false;
async function ensureReminderChannel(): Promise<void> {
  if (!IS_NATIVE || channelCreated) return;
  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: "Reja eslatmalari (muhim)",
      description: "Maqsadlar uchun ovozli eslatmalar — bezovta rejimini yengishga harakat qiladi",
      importance: 5, // MAX — heads-up notification, qattiq tovush
      visibility: 1, // PUBLIC — qulflangan ekranda ham
      sound: "default", // tizim default alarm sound
      vibration: true,
      lights: true,
      lightColor: "#D4B86A", // oltin
    });
    channelCreated = true;
  } catch (err) {
    console.warn("[goal-reminders] channel create failed", err);
  }
}

const FEMALE_VOICE = "coral"; // iliq, mehribon ayol ovozi

function toISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildReminderMessage(firstName: string, goalTitle: string): string {
  const name = firstName && firstName !== "do'st" ? firstName : "azizim";
  return `Ey Muhammad sollallohu alayhi va sallam ummatidan ${name}, ${goalTitle} vazifasini bajaring. Bu sizning niyatingiz edi.`;
}

// localStorage'dan eng so'nggi goal ma'lumotini o'qiymiz — taymer ishlagan
// paytdagi React state stale bo'lishi mumkin.
function readFreshGoal(goalId: string): Goal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("niyat:goals:list");
    if (!raw) return null;
    const list = JSON.parse(raw) as Goal[];
    return list.find((g) => g.id === goalId) ?? null;
  } catch {
    return null;
  }
}

export function useGoalReminders() {
  const { goals } = useGoals();
  const { profile } = useUserProfile();
  const { settings } = useSettings();
  const tts = useCoachTTS();
  const timersRef = useRef<number[]>([]);
  // Bir kun ichida bir maqsad uchun bir martagina ishga tushishi uchun
  const firedRef = useRef<Set<string>>(new Set());

  // ========== NATIVE (Capacitor APK) yo'l ==========
  // Android'da @capacitor/local-notifications orqali ilova yopiq bo'lganda
  // ham notification chiqadi. Ringtone bilan birga.
  useEffect(() => {
    if (!IS_NATIVE) return;
    if (!settings.notifications.goalVoiceReminderEnabled) return;

    let cancelled = false;
    (async () => {
      // Ruxsat so'rash
      try {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== "granted") return;
      } catch (err) {
        console.warn("[goal-reminders] permission failed", err);
        return;
      }
      if (cancelled) return;

      // Maxsus kanal yaratish (bezovta rejimini yengishga harakat)
      await ensureReminderChannel();
      if (cancelled) return;

      // Eski jadvallarni tozalash — endi qaytadan rejalashtirilamiz
      try {
        const pending = await LocalNotifications.getPending();
        const idsToCancel = pending.notifications
          .filter((n) =>
            typeof n.extra === "object" &&
            n.extra !== null &&
            (n.extra as { type?: string }).type === "goal-reminder",
          )
          .map((n) => ({ id: n.id }));
        if (idsToCancel.length > 0) {
          await LocalNotifications.cancel({ notifications: idsToCancel });
        }
      } catch (err) {
        console.warn("[goal-reminders] cancel pending failed", err);
      }
      if (cancelled) return;

      const now = new Date();
      const delayMin = Math.max(
        0,
        settings.notifications.goalVoiceReminderDelayMinutes,
      );

      const scheduleList: Array<{
        id: number;
        title: string;
        body: string;
        schedule: { at: Date; allowWhileIdle?: boolean };
        smallIcon?: string;
        channelId?: string;
        sound?: string;
        extra: Record<string, string>;
      }> = [];

      for (const g of goals) {
        if (!shouldShowToday(g, now)) continue;
        if (!g.timeOfDay) continue;
        if (isCompletedToday(g, now)) continue;

        const [h, m] = g.timeOfDay.split(":").map(Number);
        const fireAt = new Date(now);
        fireAt.setHours(h ?? 0, m ?? 0, 0, 0);
        if (fireAt.getTime() <= now.getTime()) continue;

        // ID — barqaror raqam (goal id'dan hash). Bir kun ichida bir xil bo'lishi
        // muhim — qayta rejalashtirilganda dublikat bo'lmasligi uchun.
        const baseId = hashString(g.id) & 0x7fffffff;

        // 1) Birinchi notification — aniq vaqtda (oddiy, default channel)
        scheduleList.push({
          id: baseId,
          title: `Reja vaqti: ${g.title}`,
          body: `Soat ${g.timeOfDay} — "Bugun bajardim" tugmasini bosing`,
          schedule: { at: fireAt, allowWhileIdle: true },
          extra: { type: "goal-reminder", goalId: g.id, stage: "initial" },
        });

        // 2) Ikkinchi notification — X daq keyin (agar bajarilmasa)
        // Bu MAXSUS kanal orqali — bezovta rejimini yengishga harakat qiladi
        const followupAt = new Date(fireAt.getTime() + delayMin * 60 * 1000);
        const name =
          profile.firstName && profile.firstName !== "do'st"
            ? profile.firstName
            : "azizim";
        scheduleList.push({
          id: baseId + 1,
          title: `${name}, sizning niyatingiz`,
          body: `Ey Muhammad sollallohu alayhi va sallam ummatidan ${name}, "${g.title}" vazifasini bajaring. Bu sizning niyatingiz edi.`,
          schedule: { at: followupAt, allowWhileIdle: true },
          channelId: REMINDER_CHANNEL_ID, // urgent channel — qattiq tovush
          sound: "default",
          extra: { type: "goal-reminder", goalId: g.id, stage: "followup" },
        });
      }

      if (scheduleList.length === 0) return;
      try {
        await LocalNotifications.schedule({ notifications: scheduleList });
      } catch (err) {
        console.warn("[goal-reminders] schedule failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    goals,
    profile.firstName,
    settings.notifications.goalVoiceReminderEnabled,
    settings.notifications.goalVoiceReminderDelayMinutes,
  ]);

  // ========== WEB / brauzer yo'l ==========
  // Ilova ochiq turganda — browser notification + TTS audio
  useEffect(() => {
    if (IS_NATIVE) return; // Native muhitda yuqoridagi useEffect ishlaydi
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    if (!settings.notifications.goalVoiceReminderEnabled) return;

    const now = new Date();
    const todayKey = toISODate(now);
    const delayMs =
      Math.max(0, settings.notifications.goalVoiceReminderDelayMinutes) * 60 * 1000;

    for (const g of goals) {
      if (!shouldShowToday(g, now)) continue;
      if (!g.timeOfDay) continue;
      if (isCompletedToday(g, now)) continue;

      const [h, m] = g.timeOfDay.split(":").map(Number);
      const fireAt = new Date(now);
      fireAt.setHours(h ?? 0, m ?? 0, 0, 0);
      const delay = fireAt.getTime() - now.getTime();
      if (delay <= 0 || delay > 24 * 60 * 60 * 1000) continue;

      const fireKey = `${g.id}:${todayKey}`;
      if (firedRef.current.has(fireKey)) continue;

      const id = window.setTimeout(() => {
        firedRef.current.add(fireKey);
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(`Reja vaqti: ${g.title}`, {
              body: `Soat ${g.timeOfDay} — "Bugun bajardim" tugmasini bosing`,
              icon: "/yuksalish.logo.png",
              tag: `goal-${g.id}`,
            });
          } catch (err) {
            console.warn("[goal-reminders] notification failed", err);
          }
        }

        const followupId = window.setTimeout(() => {
          const fresh = readFreshGoal(g.id);
          if (!fresh) return;
          if (isCompletedToday(fresh)) return;
          const message = buildReminderMessage(profile.firstName, g.title);
          tts.speak(message, FEMALE_VOICE).catch((err) => {
            console.warn("[goal-reminders] TTS failed", err);
          });
        }, delayMs);
        timersRef.current.push(followupId);
      }, delay);
      timersRef.current.push(id);
    }

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [
    goals,
    profile.firstName,
    settings.notifications.goalVoiceReminderEnabled,
    settings.notifications.goalVoiceReminderDelayMinutes,
    tts,
  ]);
}

// Barqaror raqamli ID — goal.id stringidan
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
