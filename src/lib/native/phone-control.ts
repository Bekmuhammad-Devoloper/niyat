// Native Capacitor plugin "PhoneControl" uchun TypeScript bridge.
// Android Intent orqali tashqi ilovalarni ochish, qo'ng'iroq qilish,
// SMS yuborish, alarm qo'yish.

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface PhoneControlPlugin {
  openApp(opts: { name: string }): Promise<{ launched: boolean }>;
  call(opts: { target: string }): Promise<{ ok: boolean }>;
  sms(opts: { target: string; body: string }): Promise<{ ok: boolean }>;
  setAlarm(opts: { time: string; label: string }): Promise<{ ok: boolean }>;
}

const noop: PhoneControlPlugin = {
  openApp: async () => ({ launched: false }),
  call: async () => ({ ok: false }),
  sms: async () => ({ ok: false }),
  setAlarm: async () => ({ ok: false }),
};

export const PhoneControl: PhoneControlPlugin = Capacitor.isNativePlatform()
  ? registerPlugin<PhoneControlPlugin>("PhoneControl")
  : noop;

export const PHONE_CONTROL_AVAILABLE = Capacitor.isNativePlatform();
