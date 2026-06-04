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
import { VoiceReminder } from "@/lib/native/voice-reminder";
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
  return `Ey Muhammad sollallohu alayhi va sallam ummatidan ${name}, siz "${goalTitle}" maqsadingizni bajarmadingiz. Bu sizning maqsadingiz edi.`;
}

// Diqqat tortuvchi qo'ng'iroq — TTS'dan oldin chalinadigan qisqa 2 ta beep.
// Web Audio API orqali — tashqi fayl yoki ruxsat shart emas, hamma joyda
// ishlaydi. Maksimal balandlikda chiqadi (telefon volume ga bog'liq).
function playAttentionChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playBeep = (freq: number, startAt: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      // Envelope: tez ko'tarilish, sekin pasayish — bezovta qilmasdan diqqat tortadi
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(0.95, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + startAt + duration,
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration + 0.05);
    };

    // 2 ta qo'ng'iroq — yuqori va past oraliqda (1.2 soniya ichida)
    playBeep(880, 0, 0.25);
    playBeep(660, 0.35, 0.4);

    // Resurslarni tozalash
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 1500);
  } catch (err) {
    console.warn("[goal-reminders] chime failed", err);
  }
}

// Brauzer ichidagi tabiiy TTS — server /api/tts yo'q yoki ishlamasa (APK)
// ham audio chiqsin uchun. Capacitor WebView (Chrome WebView) speechSynthesis
// API'ni qo'llab-quvvatlaydi. Tovush MAKSIMAL, sekin va aniq.
function speakViaWebSpeech(text: string, lang: string = "tr-TR"): boolean {
  if (typeof window === "undefined") return false;
  const synth = window.speechSynthesis;
  if (!synth) return false;

  // Chrome'da voices ba'zan kech yuklanadi — kerakli bo'lsa voiceschanged eventini kutamiz
  const speakNow = () => {
    try {
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      // O'zbekcha ovoz aksar qurilmalarda yo'q — turkcha eng yaqin
      const pick =
        voices.find((v) => v.lang.startsWith("uz")) ||
        voices.find((v) => v.lang.startsWith("tr")) ||
        voices.find((v) => v.lang.startsWith("ru")) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];
      if (pick) utter.voice = pick;
      utter.lang = pick?.lang ?? lang;
      // Sekinroq va aniqroq o'qish — to'liq eshitilsin
      utter.rate = 0.88;
      utter.pitch = 1.0;
      utter.volume = 1.0; // MAKSIMAL
      synth.speak(utter);
    } catch (err) {
      console.warn("[goal-reminders] webspeech speak failed", err);
    }
  };

  if (synth.getVoices().length === 0) {
    // Voices hali yuklanmagan — bir marta event'ni kutamiz, keyin so'zlaymiz
    const onVoices = () => {
      synth.removeEventListener("voiceschanged", onVoices);
      speakNow();
    };
    synth.addEventListener("voiceschanged", onVoices);
    // Backup: 500ms'dan keyin baribir urinib ko'ramiz
    window.setTimeout(speakNow, 500);
  } else {
    speakNow();
  }
  return true;
}

// Ovozli eslatmani ishonchli o'qib berish:
//   1) Avval qisqa diqqat-tortuvchi qo'ng'iroq (telefon poyma-poy bo'lsa ham eshitiladi)
//   2) Server TTS (sifatli ayol ovozi)
//   3) Server xato bersa → brauzer ichidagi speechSynthesis (offline ham ishlaydi)
async function speakReminder(
  tts: ReturnType<typeof useCoachTTS>,
  text: string,
): Promise<void> {
  // 1) Avval qo'ng'iroq chalamiz — TTS yuklanguncha diqqatni tortadi
  playAttentionChime();

  // 2) Qo'ng'iroq tugagandan keyin TTS (1.3s kechiktirib)
  await new Promise<void>((resolve) => window.setTimeout(resolve, 1300));

  try {
    await tts.speak(text, FEMALE_VOICE);
    return;
  } catch (err) {
    console.warn("[goal-reminders] server TTS failed, fallback to webspeech", err);
  }
  speakViaWebSpeech(text);
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
        const name =
          profile.firstName && profile.firstName !== "do'st"
            ? profile.firstName
            : "azizim";

        // 1) Birinchi notification — aniq vaqtda (oddiy yozuvli)
        scheduleList.push({
          id: baseId,
          title: `Reja vaqti: ${g.title}`,
          body: `Soat ${g.timeOfDay} — "Bugun bajardim" tugmasini bosing`,
          schedule: { at: fireAt, allowWhileIdle: true },
          extra: { type: "goal-reminder", goalId: g.id, stage: "initial" },
        });

        // 2) Ikkinchi notification — X daq keyin, BALAND kanal orqali.
        // Ilova yopiq bo'lsa ham Android tizim alarm tovushini yangratadi.
        // Body'da to'liq matn — foydalanuvchi telefonini qulfdan chiqarsa,
        // butun xabarni o'qiy oladi. Ilova ochiq bo'lsa, listener TTS bilan
        // baland ovozda o'qib beradi.
        const followupAt = new Date(fireAt.getTime() + delayMin * 60 * 1000);
        const voicePhrase = buildReminderMessage(profile.firstName, g.title);
        scheduleList.push({
          id: baseId + 1,
          title: `🔔 ${name}, niyatingiz`,
          body: voicePhrase,
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

      // VoiceReminder native plugin — ilova yopiq bo'lganda ham
      // Android TTS engine'i orqali matnni baland ovozda o'qib beradi.
      // Avval eskilarini tozalaymiz.
      try {
        await VoiceReminder.cancelAll();
      } catch (err) {
        console.warn("[goal-reminders] voiceReminder cancelAll failed", err);
      }

      for (const g of goals) {
        if (!shouldShowToday(g, now)) continue;
        if (!g.timeOfDay) continue;
        if (isCompletedToday(g, now)) continue;

        const [h, m] = g.timeOfDay.split(":").map(Number);
        const fireAt = new Date(now);
        fireAt.setHours(h ?? 0, m ?? 0, 0, 0);
        const followupAt = fireAt.getTime() + delayMin * 60 * 1000;
        if (followupAt <= now.getTime()) continue;

        const baseId = hashString(g.id) & 0x7fffffff;
        const voicePhrase = buildReminderMessage(profile.firstName, g.title);
        try {
          await VoiceReminder.schedule({
            id: baseId + 2, // notification ID'lari bilan to'qnashmasligi uchun
            text: voicePhrase,
            triggerAtMs: followupAt,
          });
        } catch (err) {
          console.warn("[goal-reminders] voiceReminder schedule failed", err);
        }
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

  // ========== NATIVE: foreground'da ovozli o'qib berish ==========
  // LocalNotifications faqat tovush chiqaradi — TTS audio chiqarmaydi.
  // Ilova ochiq turganda followup eslatma kelganda matnni TTS bilan o'qiymiz.
  useEffect(() => {
    if (!IS_NATIVE) return;
    if (!settings.notifications.goalVoiceReminderEnabled) return;

    let receivedHandle: { remove: () => Promise<void> } | null = null;
    let actionHandle: { remove: () => Promise<void> } | null = null;

    (async () => {
      try {
        receivedHandle = await LocalNotifications.addListener(
          "localNotificationReceived",
          (notif) => {
            const extra = (notif.extra ?? {}) as {
              type?: string;
              stage?: string;
              goalId?: string;
            };
            if (extra.type !== "goal-reminder") return;
            if (extra.stage !== "followup") return;
            if (!extra.goalId) return;
            const fresh = readFreshGoal(extra.goalId);
            if (!fresh) return;
            if (isCompletedToday(fresh)) return;
            const message = buildReminderMessage(profile.firstName, fresh.title);
            void speakReminder(tts, message);
          },
        );
        // Foydalanuvchi notification'ga bosganda ham — TTS o'qib bersin
        actionHandle = await LocalNotifications.addListener(
          "localNotificationActionPerformed",
          (action) => {
            const extra = (action.notification.extra ?? {}) as {
              type?: string;
              stage?: string;
              goalId?: string;
            };
            if (extra.type !== "goal-reminder") return;
            if (!extra.goalId) return;
            const fresh = readFreshGoal(extra.goalId);
            if (!fresh) return;
            if (isCompletedToday(fresh)) return;
            const message = buildReminderMessage(profile.firstName, fresh.title);
            void speakReminder(tts, message);
          },
        );
      } catch (err) {
        console.warn("[goal-reminders] addListener failed", err);
      }
    })();

    return () => {
      void receivedHandle?.remove();
      void actionHandle?.remove();
    };
  }, [profile.firstName, settings.notifications.goalVoiceReminderEnabled, tts]);

  // ========== WEB / brauzer yo'l ==========
  // Ilova ochiq turganda — browser notification + TTS audio.
  // Muhim: initial notification va followup TTS uchun ALOHIDA timer va
  // alohida fireKey ishlatamiz. Sababi:
  //   1) Reja vaqti hozirgi paytdan oldin bo'lsa ham, followup (vaqt + delay)
  //      hali kelmagan bo'lishi mumkin — uni baribir rejalashtirish kerak.
  //   2) useEffect re-run paytida cleanup nested setTimeout'ni o'chirar edi
  //      va firedRef tufayli qayta qo'yilmas edi — endi har bir timer
  //      mustaqil hisoblanadi va qayta tiklash to'g'ri ishlaydi.
  useEffect(() => {
    if (IS_NATIVE) return; // Native muhitda yuqoridagi useEffect ishlaydi
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    if (!settings.notifications.goalVoiceReminderEnabled) return;

    const now = new Date();
    const todayKey = toISODate(now);
    const delayMs =
      Math.max(0, settings.notifications.goalVoiceReminderDelayMinutes) * 60 * 1000;
    const ONE_DAY = 24 * 60 * 60 * 1000;

    for (const g of goals) {
      if (!shouldShowToday(g, now)) continue;
      if (!g.timeOfDay) continue;
      if (isCompletedToday(g, now)) continue;

      const [h, m] = g.timeOfDay.split(":").map(Number);
      const fireAt = new Date(now);
      fireAt.setHours(h ?? 0, m ?? 0, 0, 0);
      const followupAt = fireAt.getTime() + delayMs;

      // 1) INITIAL notification — reja vaqti kelganda (yozuvli xabar)
      const initialDelay = fireAt.getTime() - now.getTime();
      const initialKey = `${g.id}:${todayKey}:initial`;
      if (
        initialDelay > 0 &&
        initialDelay < ONE_DAY &&
        !firedRef.current.has(initialKey)
      ) {
        const id = window.setTimeout(() => {
          firedRef.current.add(initialKey);
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
        }, initialDelay);
        timersRef.current.push(id);
      }

      // 2) FOLLOWUP ovozli xabar — reja + delay daqiqa keyin.
      // Reja vaqti o'tib bo'lgan bo'lsa ham, followup hali kelmagan bo'lsa,
      // baribir rejalashtirish kerak.
      const followupDelay = followupAt - now.getTime();
      const followupKey = `${g.id}:${todayKey}:followup`;
      if (
        followupDelay > 0 &&
        followupDelay < ONE_DAY &&
        !firedRef.current.has(followupKey)
      ) {
        const id = window.setTimeout(() => {
          firedRef.current.add(followupKey);
          const fresh = readFreshGoal(g.id);
          if (!fresh) return;
          if (isCompletedToday(fresh)) return;
          const message = buildReminderMessage(profile.firstName, fresh.title);
          void speakReminder(tts, message);
        }, followupDelay);
        timersRef.current.push(id);
      }
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
