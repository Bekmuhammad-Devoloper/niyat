// Custom Capacitor plugin "VoiceReminder" uchun TypeScript bridge.
// Android'da AlarmManager + ForegroundService + TextToSpeech engine'idan
// foydalanib, ilova butunlay yopiq bo'lganda ham belgilangan vaqtga matnni
// baland ovozda o'qib beradi.
//
// API:
//   schedule({ id, text, triggerAtMs }) — alarm qo'yadi
//   cancel({ id })                       — alarmni bekor qiladi
//   cancelAll()                          — barcha alarmlarni bekor qiladi
//   canScheduleExact()                   — Android 12+ exact alarm ruxsati bormi

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface VoiceReminderPlugin {
  schedule(opts: {
    id: number;
    text: string;
    triggerAtMs: number;
  }): Promise<{ scheduled: boolean; id: number }>;
  cancel(opts: { id: number }): Promise<{ cancelled: boolean }>;
  cancelAll(): Promise<{ cancelled: boolean; count: number }>;
  canScheduleExact(): Promise<{ allowed: boolean }>;
}

// Plugin faqat native Android'da mavjud. Web'da har bir method silent no-op.
const noop: VoiceReminderPlugin = {
  schedule: async ({ id }) => ({ scheduled: false, id }),
  cancel: async () => ({ cancelled: false }),
  cancelAll: async () => ({ cancelled: false, count: 0 }),
  canScheduleExact: async () => ({ allowed: false }),
};

export const VoiceReminder: VoiceReminderPlugin = Capacitor.isNativePlatform()
  ? registerPlugin<VoiceReminderPlugin>("VoiceReminder")
  : noop;

export const VOICE_REMINDER_AVAILABLE = Capacitor.isNativePlatform();
