// Niyat AI'ning telefon boshqaruv qatlami.
//
// AI javobida maxsus blok'lar bo'lishi mumkin: ⟦command:arg1:arg2⟧
// Shu modul ularni ajratadi, bajaradi va matnni tozalaydi (TTS o'qiganda
// foydalanuvchi blok matnini eshitmasligi uchun).
//
// Native Android (Capacitor APK) — to'liq ishlaydi (PhoneControl plugin).
// Web/desktop — fallback xabar berib o'tib ketadi.

import { Capacitor } from "@capacitor/core";
import { PhoneControl } from "@/lib/native/phone-control";

// Buyruq turlari va ularning argument formatlari
export type CommandKind =
  | "open_app"
  | "call"
  | "sms"
  | "alarm"
  | "play_quran"
  | "play_music"
  | "open_url";

export type ParsedCommand = {
  kind: CommandKind;
  args: string[];
  raw: string;
};

// AI javobidan ⟦...⟧ bloklarini ajratamiz. Misol:
//   "Albatta, Telegram'ni ochaman. ⟦open_app:Telegram⟧"
// → kind: open_app, args: ["Telegram"]
//
// Brace alternative: AI ba'zan oddiy [...] yoki {{ ... }} ham yozadi —
// hammasini qo'llab-quvvatlash uchun.
const COMMAND_RE = /[⟦\[{]{1,2}\s*(open_app|call|sms|alarm|play_quran|play_music|open_url)\s*:\s*([^⟧\]}]*?)\s*[⟧\]}]{1,2}/gi;

export function parsePhoneCommands(text: string): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  const re = new RegExp(COMMAND_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const kind = match[1].toLowerCase() as CommandKind;
    const argsStr = match[2] ?? "";
    const args = argsStr
      .split(":")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    commands.push({ kind, args, raw: match[0] });
  }
  return commands;
}

// Matndan command bloklarini olib tashlash — TTS uchun toza matn
export function stripPhoneCommands(text: string): string {
  return text
    .replace(new RegExp(COMMAND_RE.source, "gi"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Bitta command'ni bajarish
async function runCommand(cmd: ParsedCommand): Promise<{
  ok: boolean;
  message?: string;
}> {
  const isNative = Capacitor.isNativePlatform();
  try {
    switch (cmd.kind) {
      case "open_app": {
        const name = cmd.args[0];
        if (!name) return { ok: false, message: "ilova nomi yo'q" };
        if (isNative) {
          await PhoneControl.openApp({ name });
          return { ok: true };
        }
        return { ok: false, message: "web'da ishlamaydi" };
      }
      case "call": {
        const target = cmd.args[0];
        if (!target) return { ok: false, message: "raqam yo'q" };
        if (isNative) {
          await PhoneControl.call({ target });
          return { ok: true };
        }
        // Web fallback — tel: link ochish
        window.open(`tel:${target}`, "_self");
        return { ok: true };
      }
      case "sms": {
        const target = cmd.args[0];
        const body = cmd.args.slice(1).join(":");
        if (!target) return { ok: false, message: "raqam yo'q" };
        if (isNative) {
          await PhoneControl.sms({ target, body: body ?? "" });
          return { ok: true };
        }
        window.open(`sms:${target}?body=${encodeURIComponent(body)}`, "_self");
        return { ok: true };
      }
      case "alarm": {
        const time = cmd.args[0]; // HH:mm
        const label = cmd.args[1] ?? "Niyat eslatma";
        if (!time) return { ok: false, message: "vaqt yo'q" };
        if (isNative) {
          await PhoneControl.setAlarm({ time, label });
          return { ok: true };
        }
        return { ok: false, message: "web'da ishlamaydi" };
      }
      case "play_quran": {
        const surah = cmd.args[0] ?? "Fotiha";
        // Ichki Qur'on player'ini ishga tushirish uchun custom event
        window.dispatchEvent(
          new CustomEvent("niyat:action:play_quran", { detail: { surah } }),
        );
        return { ok: true };
      }
      case "play_music": {
        if (isNative) {
          await PhoneControl.openApp({ name: cmd.args[0] ?? "Music" });
          return { ok: true };
        }
        return { ok: false, message: "web'da ishlamaydi" };
      }
      case "open_url": {
        const url = cmd.args[0];
        if (!url) return { ok: false, message: "URL yo'q" };
        window.open(url, "_blank");
        return { ok: true };
      }
      default:
        return { ok: false, message: "noma'lum buyruq" };
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "xato",
    };
  }
}

// AI javobidagi BARCHA command'larni topib bajarish + toza matn qaytarish.
// `executed` — bajarilgan command nomlari ro'yxati (logging uchun).
export async function executePhoneCommands(text: string): Promise<{
  cleanText: string;
  executed: Array<{ cmd: ParsedCommand; ok: boolean; message?: string }>;
}> {
  const commands = parsePhoneCommands(text);
  const executed: Array<{
    cmd: ParsedCommand;
    ok: boolean;
    message?: string;
  }> = [];
  for (const cmd of commands) {
    const result = await runCommand(cmd);
    executed.push({ cmd, ...result });
  }
  return {
    cleanText: stripPhoneCommands(text),
    executed,
  };
}
