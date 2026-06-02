import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronRight,
  MapPin,
  Volume2,
  Bell,
  Shield,
  CreditCard,
  HelpCircle,
  Sparkles,
  Play,
  Pause,
  Trash2,
  BookOpen,
  Flame,
  Globe,
  Code2,
  Smartphone,
  Brain,
  Palette,
  TrendingUp,
  Send,
  Mail,
  ExternalLink,
  Instagram,
  Github,
  Megaphone,
  Cake,
  Mic,
  Infinity as InfinityIcon,
  Phone,
  BarChart3,
  ShieldAlert,
  Moon,
  Clock,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { useAppBlocking } from "@/lib/hooks/use-app-blocking";
import { BottomSheet } from "./BottomSheet";
import { Picker, TimePicker, Slider } from "./form";
import { Flag } from "./Flag";
import { NiyatLogo } from "./Logo";
import { AI_PERSONALITIES, type AIPersonalityKey, type Madhhab } from "@/lib/settings";
import { useSettings } from "@/lib/hooks/use-settings";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useSpeechSynthesis } from "@/lib/hooks/use-speech";
import { useStats } from "@/lib/hooks/use-stats";
import { useLocalState } from "@/lib/use-local-state";
import { useUserProfile, isPremiumActive, premiumDaysLeft } from "@/lib/hooks/use-user-profile";
import { useSunnat } from "@/lib/hooks/use-sunnat";
import { useSunnatSimplify } from "@/lib/hooks/use-sunnat-simplify";
import { useQuranSurah, useQuranChapters, useReciters } from "@/lib/hooks/use-quran-surah";
import { useQuranPlayer } from "@/lib/audio/quran-player";
import { DEFAULT_RECITER_ID, POPULAR_RECITERS } from "@/lib/api/quran";
import { useAsmaProgress } from "@/lib/hooks/use-asma";
import { useAppTime } from "@/lib/hooks/use-app-time";
import { CATEGORY_LABELS, type Sunnat, type SunnatCategory } from "@/lib/data/sunnats";
import { autoCapitalize } from "@/lib/text-utils";

// =========================================================
// AI Personality
// =========================================================
export function AIPersonalitySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();
  return (
    <BottomSheet open={open} onClose={onClose} title="AI shaxsiyati">
      <p className="text-[13px] text-muted-foreground mb-4">
        Murabbiyning ohangini tanlang. Suhbat darhol o'zgaradi.
      </p>
      <div className="space-y-2">
        {AI_PERSONALITIES.map((p) => {
          const active = settings.aiPersonality === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                update({ aiPersonality: p.key as AIPersonalityKey });
                toast.success(`Ohang: ${p.label}`);
              }}
              className={`w-full text-left p-4 rounded-2xl border transition ${
                active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-foreground">{p.label}</p>
                  <p className="text-[12px] text-tertiary mt-1">{p.description}</p>
                </div>
                {active && <Check size={16} className="text-primary mt-1 shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

// =========================================================
// Notifications settings
// =========================================================
export function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();
  const { permission, request } = useNotifications();
  const n = settings.notifications;

  const togglePrayer = async () => {
    if (!n.prayerReminders && permission !== "granted") {
      const ok = await request();
      if (!ok) {
        toast.error("Bildirishnoma ruxsati berilmadi");
        return;
      }
    }
    update({ notifications: { ...n, prayerReminders: !n.prayerReminders } });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Bildirishnomalar">
      <div className="space-y-3">
        <Row
          icon={<Bell size={16} className="text-primary" />}
          title="Namoz eslatmalari"
          subtitle={`Har namozdan ${n.reminderMinutes} daqiqa oldin`}
        >
          <Toggle checked={n.prayerReminders} onChange={togglePrayer} />
        </Row>
        {n.prayerReminders && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <p className="text-[12px] text-tertiary mb-2">Necha daqiqa oldin</p>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 30].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update({ notifications: { ...n, reminderMinutes: m } })}
                  className={`py-2 rounded-lg text-[13px] transition ${
                    n.reminderMinutes === m
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-elevated text-foreground"
                  }`}
                >
                  {m} daq
                </button>
              ))}
            </div>
          </div>
        )}
        <Row
          icon={<Bell size={16} className="text-primary" />}
          title="Kunlik niyat eslatmasi"
          subtitle={`Har kuni ${n.niyatHour}:00 da`}
        >
          <Toggle
            checked={n.dailyNiyat}
            onChange={() => update({ notifications: { ...n, dailyNiyat: !n.dailyNiyat } })}
          />
        </Row>
        <Row
          icon={<Bell size={16} className="text-primary" />}
          title="Bajarilmagan niyatlar eslatmasi"
          subtitle={`Har ${n.niyatPersistHours} soatda, kun davomida`}
        >
          <Toggle
            checked={n.niyatPersistReminders}
            onChange={async () => {
              if (!n.niyatPersistReminders && permission !== "granted") {
                const ok = await request();
                if (!ok) {
                  toast.error("Bildirishnoma ruxsati berilmadi");
                  return;
                }
              }
              update({
                notifications: { ...n, niyatPersistReminders: !n.niyatPersistReminders },
              });
            }}
          />
        </Row>
        {n.niyatPersistReminders && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <p className="text-[12px] text-tertiary mb-2">Eslatma oralig'i</p>
            <div className="grid grid-cols-4 gap-2">
              {[2, 3, 4, 6].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => update({ notifications: { ...n, niyatPersistHours: h } })}
                  className={`py-2 rounded-lg text-[13px] transition ${
                    n.niyatPersistHours === h
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-elevated text-foreground"
                  }`}
                >
                  {h} soat
                </button>
              ))}
            </div>
          </div>
        )}
        <Row
          icon={<Bell size={16} className="text-primary" />}
          title="Onaga qo'ng'iroq eslatmasi"
          subtitle="Har kuni kechki vaqt"
        >
          <Toggle
            checked={n.motherCallReminder}
            onChange={() =>
              update({ notifications: { ...n, motherCallReminder: !n.motherCallReminder } })
            }
          />
        </Row>
        <Row
          icon={<BookOpen size={16} className="text-primary" />}
          title="Bugungi sunnat"
          subtitle={`Har kuni ${n.sunnatHour}:00 da`}
        >
          <Toggle
            checked={n.dailySunnat}
            onChange={async () => {
              if (!n.dailySunnat && permission !== "granted") {
                const ok = await request();
                if (!ok) {
                  toast.error("Bildirishnoma ruxsati berilmadi");
                  return;
                }
              }
              update({ notifications: { ...n, dailySunnat: !n.dailySunnat } });
            }}
          />
        </Row>
        <Row
          icon={<Volume2 size={16} className="text-primary" />}
          title="Reja ovozli eslatma"
          subtitle={`Vaqt kelgach ${n.goalVoiceReminderDelayMinutes} daq · bajarilmasa ayol ovozida eslatma`}
        >
          <Toggle
            checked={n.goalVoiceReminderEnabled}
            onChange={async () => {
              if (!n.goalVoiceReminderEnabled && permission !== "granted") {
                const ok = await request();
                if (!ok) {
                  toast.error("Bildirishnoma ruxsati berilmadi");
                  return;
                }
              }
              update({
                notifications: {
                  ...n,
                  goalVoiceReminderEnabled: !n.goalVoiceReminderEnabled,
                },
              });
            }}
          />
        </Row>
        {n.goalVoiceReminderEnabled && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <p className="text-[12px] text-tertiary mb-2">
              Bajardim bosilmasa, qancha daqiqada ovozli eslatma?
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 5, 10].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    update({
                      notifications: { ...n, goalVoiceReminderDelayMinutes: m },
                    })
                  }
                  className={`py-2 rounded-lg text-[13px] transition ${
                    n.goalVoiceReminderDelayMinutes === m
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-elevated text-foreground"
                  }`}
                >
                  {m} daq
                </button>
              ))}
            </div>
          </div>
        )}
        <Row
          icon={<Volume2 size={16} className="text-primary" />}
          title="Avtomatik azon"
          subtitle={`Namozdan ${n.adhanLeadMinutes} daqiqa oldin · loop bo'lib aytaveradi`}
        >
          <Toggle
            checked={n.adhanEnabled}
            onChange={async () => {
              if (!n.adhanEnabled && permission !== "granted") {
                const ok = await request();
                if (!ok) {
                  toast.error("Bildirishnoma ruxsati berilmadi");
                  return;
                }
              }
              update({
                notifications: { ...n, adhanEnabled: !n.adhanEnabled },
              });
            }}
          />
        </Row>
        {n.adhanEnabled && (
          <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
            <div>
              <p className="text-[12px] text-tertiary mb-2">Necha daqiqa oldin</p>
              <div className="grid grid-cols-4 gap-2">
                {[3, 5, 10, 15].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      update({
                        notifications: { ...n, adhanLeadMinutes: m },
                      })
                    }
                    className={`py-2 rounded-lg text-[13px] transition ${
                      n.adhanLeadMinutes === m
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-elevated text-foreground"
                    }`}
                  >
                    {m} daq
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="adhan-url" className="block text-[12px] text-tertiary mb-1.5">
                Azon URL (ixtiyoriy — bo'sh bo'lsa default ishlatiladi)
              </label>
              <input
                id="adhan-url"
                type="url"
                value={n.adhanUrl}
                onChange={(e) =>
                  update({ notifications: { ...n, adhanUrl: e.target.value } })
                }
                placeholder="https://example.com/adhan.mp3"
                className="w-full bg-elevated border border-border rounded-md px-3 py-2 text-[12px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60"
              />
              <p className="mt-1 text-[10px] text-tertiary leading-relaxed">
                Eslatma: brauzer/PWA telefon bezovta rejimini yenmaydi (OS chegarasi).
                Lekin ilova ochiq bo'lsa, audio loop bo'lib aytaveradi — Mini player'dan
                to'xtatasiz.
              </p>
            </div>
          </div>
        )}
        <Row
          icon={<MapPin size={16} className="text-primary" />}
          title="Juma kuni eng yaqin masjid"
          subtitle={`Har juma ${n.fridayMosqueHour}:00 da · joylashuv kerak`}
        >
          <Toggle
            checked={n.fridayMosqueReminder}
            onChange={async () => {
              if (!n.fridayMosqueReminder && permission !== "granted") {
                const ok = await request();
                if (!ok) {
                  toast.error("Bildirishnoma ruxsati berilmadi");
                  return;
                }
              }
              update({
                notifications: { ...n, fridayMosqueReminder: !n.fridayMosqueReminder },
              });
            }}
          />
        </Row>
        {permission === "denied" && (
          <p className="text-[12px] text-destructive mt-2">
            Brauzer bildirishnomalarni bloklab qo'ygan. Saytni qayta sozlang.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

// =========================================================
// Prayer settings (madhhab + location)
// =========================================================
export function PrayerSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();
  const geo = useGeolocation();
  const { profile } = useUserProfile();
  const locked = profile.locationLocked;

  return (
    <BottomSheet open={open} onClose={onClose} title="Namoz sozlamalari">
      <div className="space-y-4">
        <div>
          <p className="text-[13px] text-tertiary mb-2">Madhhab</p>
          <div className="grid grid-cols-2 gap-2">
            {(["hanafi", "shafii"] as Madhhab[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => update({ madhhab: m })}
                className={`py-3 rounded-xl text-[14px] transition ${
                  settings.madhhab === m
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-card border border-border text-foreground"
                }`}
              >
                {m === "hanafi" ? "Hanafiy" : "Shofe'iy"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-tertiary mt-2">
            Madhhab Asr namozi vaqtini hisoblashda farq qiladi.
          </p>
        </div>

        <div>
          <p className="text-[13px] text-tertiary mb-2">Hisoblash usuli</p>
          <Picker
            value={settings.calculationMethod}
            onChange={(v) => update({ calculationMethod: v })}
            label="Hisoblash usuli"
            options={[
              { value: 1, label: "Karachi (Markaziy Osiyo)" },
              { value: 2, label: "ISNA (Shimoliy Amerika)" },
              { value: 3, label: "Muslim World League" },
              { value: 4, label: "Umm Al-Qura (Saudiya)" },
              { value: 5, label: "Egypt General Authority" },
              { value: 8, label: "Gulf Region" },
              { value: 9, label: "Kuwait" },
              { value: 10, label: "Qatar" },
              { value: 12, label: "UOIF (Fransiya)" },
              { value: 13, label: "Diyanet (Turkiya)" },
            ]}
          />
        </div>

        <div>
          <p className="text-[13px] text-tertiary mb-2">Joylashuv</p>
          <div className="rounded-2xl bg-card border border-border p-4">
            {settings.location ? (
              <>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-primary" />
                  <p className="text-[14px] text-foreground">{settings.location.label}</p>
                </div>
                <p className="text-[11px] tabular text-tertiary mt-1">
                  {settings.location.latitude.toFixed(4)}, {settings.location.longitude.toFixed(4)}
                </p>
                {locked ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                    <Lock size={12} className="text-primary mt-0.5 shrink-0" />
                    <p className="text-[11px] text-tertiary leading-relaxed">
                      Joylashuv admin tomonidan qulflangan — juma kuni masjid
                      eslatmasi va real namoz vaqtlari uchun. Ochirish uchun
                      admin bilan boglaning.
                    </p>
                  </div>
                ) : (
                  <LocationOffButton onConfirm={() => geo.clear()} />
                )}
              </>
            ) : (
              <>
                <p className="text-[13px] text-foreground">Toshkent (default)</p>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await geo.request();
                    if (ok) toast.success("Joylashuv olindi");
                  }}
                  disabled={geo.status === "requesting"}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold disabled:opacity-50"
                >
                  <MapPin size={14} />
                  {geo.status === "requesting"
                    ? "So'rayapti..."
                    : "Aniq joylashuvni olish"}
                </button>
                {geo.error && (
                  <p className="mt-3 text-[11px] text-destructive leading-relaxed">
                    {geo.error.message}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

// "Ochirish" tugmasi — adashib bosib qoʻymaslik uchun 3 marta tasdiq talab qiladi.
// Har bosishda hisoblagich oshadi; 5 sekund harakatsiz qolsa qayta nolga tushadi.
// 3-bosishdan keyingina onConfirm ishlaydi.
function LocationOffButton({ onConfirm }: { onConfirm: () => void }) {
  const [taps, setTaps] = useState(0);
  const resetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetRef.current) window.clearTimeout(resetRef.current);
    };
  }, []);

  const handleClick = () => {
    if (resetRef.current) window.clearTimeout(resetRef.current);
    const next = taps + 1;
    if (next >= 3) {
      setTaps(0);
      onConfirm();
      toast.info("Joylashuv ochirildi. Toshkent default ishlatiladi");
      return;
    }
    setTaps(next);
    const remaining = 3 - next;
    toast.warning(
      remaining === 2
        ? "Joylashuv ochilsa namoz vaqtlari va juma masjid eslatmasi notogri ishlaydi. Yana 2 marta bosing."
        : "Rostdan ochmoqchimisiz? Yana 1 marta bosing.",
      { duration: 4500 },
    );
    resetRef.current = window.setTimeout(() => setTaps(0), 5000);
  };

  const label =
    taps === 0
      ? "Ochirish"
      : taps === 1
        ? `Yana 2 marta bosing`
        : `Yana 1 marta bosing — oxirgi`;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`mt-3 text-[12px] transition ${
        taps === 0
          ? "text-destructive hover:text-destructive/80"
          : "text-destructive font-semibold"
      }`}
    >
      {label}
    </button>
  );
}

// =========================================================
// Voice settings
// =========================================================
export function VoiceSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();
  const tts = useSpeechSynthesis();
  const v = settings.voice;

  return (
    <BottomSheet open={open} onClose={onClose} title="Ovoz va til">
      <div className="space-y-4">
        <Row
          icon={<Mic size={16} className="text-primary" />}
          title="Mikrofon doimiy yoniq"
          subtitle="Coach ekranda — gapiring, avtomatik tinglaydi va yuboradi"
        >
          <Toggle
            checked={v.micAlwaysOn}
            onChange={() =>
              update({ voice: { ...v, micAlwaysOn: !v.micAlwaysOn } })
            }
          />
        </Row>

        {/* MVP 1 da "Orqa fonda mikrofon" toggle va exempt tugmalari yashirilgan.
            MVP 2 da foydalanuvchi koradi va boshqarish imkoniga ega bo'ladi. */}

        <Row
          icon={<Volume2 size={16} className="text-primary" />}
          title="Murabbiy javobini ovoz bilan o'qish"
          subtitle="TTS — matnni ovozga aylantiradi"
        >
          <Toggle
            checked={v.ttsEnabled}
            onChange={() => update({ voice: { ...v, ttsEnabled: !v.ttsEnabled } })}
          />
        </Row>

        {v.ttsEnabled && (
          <>
            {/* Ovoz mavjudligi ogohlantirishi */}
            {v.preferredLang.startsWith("uz") && !tts.hasNativeVoice("uz") && (
              <div className="rounded-2xl bg-card border border-primary/30 p-4">
                <p className="text-[12px] text-foreground leading-relaxed">
                  ⚠️ Brauzeringizda <strong>o'zbekcha ovoz yo'q</strong>.
                  Avtomatik ravishda <strong>Türkçe</strong> ovoziga o'tildi —
                  fonetik jihatdan eng yaqin va tushunarli.
                </p>
                <p className="mt-2 text-[11px] text-tertiary">
                  Real o'zbekcha TTS keyingi versiyada Google Cloud yoki Yandex
                  SpeechKit orqali qo'shiladi.
                </p>
              </div>
            )}

            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-[12px] text-tertiary mb-2">Til (brauzerda mavjud)</p>
              <Picker
                value={v.preferredLang}
                onChange={(val) => update({ voice: { ...v, preferredLang: val } })}
                label="Til"
                options={[
                  {
                    value: "uz-UZ",
                    label: (
                      <span className="inline-flex items-center gap-2.5">
                        <Flag code="uz" size={22} /> O'zbek
                      </span>
                    ),
                  },
                  {
                    value: "ru-RU",
                    label: (
                      <span className="inline-flex items-center gap-2.5">
                        <Flag code="ru" size={22} /> Русский
                      </span>
                    ),
                  },
                  {
                    value: "en-US",
                    label: (
                      <span className="inline-flex items-center gap-2.5">
                        <Flag code="us" size={22} /> English
                      </span>
                    ),
                  },
                  {
                    value: "tr-TR",
                    label: (
                      <span className="inline-flex items-center gap-2.5">
                        <Flag code="tr" size={22} /> Türkçe
                      </span>
                    ),
                  },
                  {
                    value: "ar-SA",
                    label: (
                      <span className="inline-flex items-center gap-2.5">
                        <Flag code="sa" size={22} /> العربية
                      </span>
                    ),
                  },
                ]}
              />
              <p className="text-[11px] text-tertiary mt-2">
                Brauzeringizda {tts.voices.length} ovoz mavjud
                {tts.lastUsedLang && tts.lastUsedLang !== v.preferredLang && (
                  <>
                    {" "}— hozir <strong className="text-primary">{tts.lastUsedLang}</strong>{" "}
                    ovozi ishlatilmoqda
                  </>
                )}
              </p>
            </div>

            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] text-tertiary">Tezlik</p>
                <p className="text-[12px] tabular text-primary font-semibold">
                  {v.ttsRate.toFixed(1)}x
                </p>
              </div>
              <Slider
                value={v.ttsRate}
                onChange={(val) => update({ voice: { ...v, ttsRate: val } })}
                min={0.5}
                max={2}
                step={0.1}
                label="Ovoz tezligi"
              />
            </div>

            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] text-tertiary">Ovoz balandligi</p>
                <p className="text-[12px] tabular text-primary font-semibold">
                  {v.ttsPitch.toFixed(1)}
                </p>
              </div>
              <Slider
                value={v.ttsPitch}
                onChange={(val) => update({ voice: { ...v, ttsPitch: val } })}
                min={0}
                max={2}
                step={0.1}
                label="Ovoz balandligi"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                tts.speak("Assalomu alaykum. Bu sinov ovozi.", {
                  lang: v.preferredLang,
                  rate: v.ttsRate,
                  pitch: v.ttsPitch,
                })
              }
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold inline-flex items-center justify-center gap-2"
            >
              <Play size={14} /> Ovozni sinab ko'rish
            </button>
          </>
        )}

        {!tts.supported && (
          <p className="text-[12px] text-destructive">
            Brauzeringiz Web Speech API'ni qo'llab-quvvatlamaydi.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

// =========================================================
// Privacy
// =========================================================
export function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Maxfiylik">
      <div className="space-y-4 text-[13px] leading-relaxed text-foreground">
        <p className="font-serif text-[15px] text-primary">Sizning ma'lumotingiz — sizniki.</p>
        <Section title="Lokal saqlash">
          Niyat, vazifa, suhbat va sozlamalar faqat shu qurilmaning brauzerida saqlanadi.
          Hech qaysi server ko'rmaydi.
        </Section>
        <Section title="AI suhbat">
          Murabbiyga yozgan xabarlaringiz Anthropic Claude API'ga yuboriladi (faqat shu
          turn'da). Tarix lokal saqlanadi.
        </Section>
        <Section title="Namoz vaqtlari">
          Aladhan.com bepul API ishlatiladi. Faqat joylashuv koordinatalari uzatiladi.
        </Section>
        <Section title="Tahlil va kuzatuv">
          MVP versiyada hech qanday analytics, tracking yoki cookie yo'q.
        </Section>
        <Section title="Hammasini o'chirish">
          <button
            type="button"
            onClick={() => {
              if (confirm("Barcha ma'lumotlarni o'chirishni xohlaysizmi? Bu qaytarib bo'lmaydi.")) {
                Object.keys(localStorage)
                  .filter((k) => k.startsWith("niyat:"))
                  .forEach((k) => localStorage.removeItem(k));
                toast.success("Hammasi o'chirildi. Sahifani yangilang.");
              }
            }}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-[13px] border border-destructive/30"
          >
            <Trash2 size={14} /> Mahalliy ma'lumotni o'chirish
          </button>
        </Section>
      </div>
    </BottomSheet>
  );
}

// =========================================================
// Premium
// =========================================================
export function PremiumSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, setProfile } = useUserProfile();
  return (
    <BottomSheet open={open} onClose={onClose} title="Niyat Premium">
      <div className="space-y-4">
        <div
          className="rounded-2xl p-5 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(184,166,107,0.20), rgba(184,166,107,0.05))",
            border: "1px solid rgba(184,166,107,0.30)",
          }}
        >
          <Sparkles size={28} className="text-primary mx-auto mb-2" />
          <p className="font-serif text-[22px] text-foreground">$5/oy</p>
          <p className="text-[12px] text-muted-foreground">O'zbekiston narxi · global $10/oy</p>
          {isPremiumActive(profile) && (
            <p className="mt-2 text-[12px] text-primary font-semibold inline-flex items-center justify-center gap-1">
              <Check size={12} />
              {profile.isPremium
                ? "Premium aktiv"
                : `Premium · ${premiumDaysLeft(profile)} kun qoldi`}
            </p>
          )}
        </div>

        <p className="text-[11px] uppercase tracking-wider text-tertiary px-1">
          Premium xususiyatlar
        </p>
        <ul className="space-y-2 text-[13px] text-foreground">
          {[
            { icon: Volume2, text: "Murabbiy javobini ovoz bilan eshitish (TTS)" },
            { icon: Mic, text: "Cheksiz ovozli xabarlar" },
            { icon: InfinityIcon, text: "Cheksiz Murabbiy — kunlik limit yo'q" },
            { icon: Brain, text: "Psiholog ohangi — yurakni yengillashtiruvchi suhbat" },
            { icon: Phone, text: "Onaga avtomatik hisobot (Telegram bot)" },
            { icon: Smartphone, text: "Ilova bloklash va anti-doomscroll (Android)" },
            { icon: BarChart3, text: "To'liq statistika va yillik Wrapped" },
            { icon: Palette, text: "Maxsus AI shaxsiyatlari va boshqa funksiyalar" },
          ].map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-3 rounded-xl bg-card border border-border px-3 py-2.5"
            >
              <span
                className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(184,166,107,0.12)",
                  border: "1px solid rgba(184,166,107,0.22)",
                }}
              >
                <Icon size={14} className="text-primary" />
              </span>
              <span className="leading-snug">{text}</span>
            </li>
          ))}
        </ul>

        {isPremiumActive(profile) ? (
          <button
            type="button"
            onClick={() => {
              if (confirm("Premium obunadan voz kechmoqchimisiz?")) {
                setProfile({
                  ...profile,
                  isPremium: false,
                  premiumExpiresAt: null,
                });
                toast.info("Premium o'chirildi");
              }
            }}
            className="w-full py-3 rounded-xl bg-card border border-border text-foreground text-[14px] font-semibold transition"
          >
            Premium'dan voz kechish
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setProfile({ ...profile, isPremium: true });
                toast.success("✨ Premium yoqildi! TTS va boshqa funksiyalar mavjud.");
              }}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <Sparkles size={14} />
              Premium'ni sinab ko'rish (demo)
            </button>
            <p className="text-center text-[11px] text-tertiary">
              Real Click/Payme to'lov integratsiyasi MVP 2 davomida qo'shiladi
            </p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

// =========================================================
// App Blocking — ilova nazorati
// =========================================================
export function AppBlockSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const blocking = useAppBlocking();
  const { profile } = useUserProfile();
  const s = blocking.settings;

  // Native plugin tayyor emas — mock notice
  const isMobile = typeof window !== "undefined" && /Android/i.test(navigator.userAgent);

  return (
    <BottomSheet open={open} onClose={onClose} title="Ilova nazorati" fullHeight>
      {/* Premium gate */}
      {!isPremiumActive(profile) && (
        <div
          className="rounded-2xl p-4 mb-4 flex items-start gap-3"
          style={{
            background:
              "linear-gradient(135deg, rgba(184,166,107,0.18), rgba(184,166,107,0.04))",
            border: "1px solid rgba(184,166,107,0.30)",
          }}
        >
          <Sparkles size={18} className="text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground">
              Premium funksiya
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              To'liq sozlash va aktivlashtirish Premium obunada. Hozir
              ko'rishingiz mumkin.
            </p>
          </div>
        </div>
      )}

      {/* Hero — statistika */}
      <div
        className="rounded-2xl p-5 fade-up"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,166,107,0.16), rgba(184,166,107,0.04))",
          border: "1px solid rgba(184,166,107,0.25)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] tracking-[0.18em] uppercase text-primary">
            Ilova nazorati
          </p>
          <Toggle
            checked={s.enabled}
            onChange={() => {
              if (!isPremiumActive(profile)) {
                toast("Premium funksiya", {
                  description: "Avval Premium'ga obuna bo'ling",
                  icon: <Sparkles size={16} className="text-primary" />,
                });
                return;
              }
              blocking.toggleEnabled();
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-tertiary">Aktiv</p>
            <p className="mt-1 text-[18px] font-semibold tabular text-foreground">
              {blocking.stats.activeCount}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-tertiary">Limit</p>
            <p className="mt-1 text-[18px] font-semibold tabular text-foreground">
              {Math.floor(blocking.stats.totalLimitMin / 60)}s{" "}
              {blocking.stats.totalLimitMin % 60}d
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-tertiary">Bugun</p>
            <p className="mt-1 text-[18px] font-semibold tabular text-foreground">
              {blocking.stats.totalUsedMin}d
            </p>
          </div>
        </div>
      </div>

      {/* Native plugin warning */}
      {!isMobile && (
        <div className="mt-4 rounded-2xl bg-card border border-border p-4 flex items-start gap-2">
          <AlertTriangle size={14} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Eslatma</strong>: ilova bloklash
            faqat <strong>Android APK</strong>'da real ishlaydi (Capacitor +
            UsageStatsManager). Web brauzerda — bu sozlamalar saqlanadi, lekin
            ilovalarni bloklamaydi.
          </p>
        </div>
      )}

      {/* Bloklanadigan ilovalar */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wider text-tertiary mb-3 px-1">
          Bloklanadigan ilovalar
        </p>
        <ul className="space-y-2">
          {s.blockedApps.map((app) => (
            <BlockedAppRow
              key={app.packageName}
              app={app}
              onToggle={() => {
                if (!isPremiumActive(profile)) {
                  toast("Premium funksiya", {
                    description: "Avval Premium'ga obuna bo'ling",
                    icon: <Sparkles size={16} className="text-primary" />,
                  });
                  return;
                }
                blocking.toggleApp(app.packageName);
              }}
              onLimitChange={(m) => {
                if (!isPremiumActive(profile)) return;
                blocking.setAppLimit(app.packageName, m);
              }}
              locked={!isPremiumActive(profile)}
            />
          ))}
        </ul>
      </div>

      {/* Tun rejimi */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wider text-tertiary mb-3 px-1">
          Tun rejimi
        </p>
        <div className="rounded-2xl bg-card border border-border p-4">
          <Row
            icon={<Moon size={16} className="text-primary" />}
            title="Tunda barcha bloklash"
            subtitle={`${s.nightMode.from} — ${s.nightMode.to}`}
          >
            <Toggle
              checked={s.nightMode.enabled}
              onChange={() => {
                if (!isPremiumActive(profile)) return;
                blocking.updateNightMode({ enabled: !s.nightMode.enabled });
              }}
            />
          </Row>
        </div>
      </div>

      {/* Anti-scroll */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wider text-tertiary mb-3 px-1">
          Anti-doomscroll
        </p>
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <Row
            icon={<ShieldAlert size={16} className="text-primary" />}
            title="Skrol tezligi nazorati"
            subtitle={`${s.antiScroll.warnAfterMinutes} daqiqadan keyin ogohlantirish`}
          >
            <Toggle
              checked={s.antiScroll.enabled}
              onChange={() => {
                if (!isPremiumActive(profile)) return;
                blocking.updateAntiScroll({ enabled: !s.antiScroll.enabled });
              }}
            />
          </Row>
        </div>
      </div>

      {/* Qanday ishlaydi (info) */}
      <div className="mt-5 mb-2 rounded-2xl bg-card border border-border p-4">
        <p className="text-[11px] uppercase tracking-wider text-tertiary mb-2">
          Qanday ishlaydi
        </p>
        <ul className="space-y-2 text-[12px] text-muted-foreground leading-relaxed">
          <li className="flex items-start gap-2">
            <Clock size={12} className="text-primary mt-0.5 shrink-0" />
            <span>
              Belgilangan ilova ochilganda, ekranda{" "}
              <strong className="text-foreground">{s.delayBeforeOpen}s</strong>{" "}
              kutib turish kerak
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Sparkles size={12} className="text-primary mt-0.5 shrink-0" />
            <span>
              Niyat eslatma chiqadi: "Bugungi niyating: 10 bet kitob — esda
              qoldingmi?"
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldAlert size={12} className="text-primary mt-0.5 shrink-0" />
            <span>
              Limit tugasa — ilova ochilmaydi, faqat sizning Murabbiy ruxsati
              bilan
            </span>
          </li>
        </ul>
      </div>

      <p className="mt-4 text-[11px] text-tertiary text-center font-serif italic">
        "Ekran vaqtingiz — sizning umringiz. Niyat bilan boshqaring."
      </p>
    </BottomSheet>
  );
}

// Bitta bloklangan ilova qatori
function BlockedAppRow({
  app,
  onToggle,
  onLimitChange,
  locked,
}: {
  app: import("@/lib/hooks/use-app-blocking").BlockedApp;
  onToggle: () => void;
  onLimitChange: (minutes: number) => void;
  locked: boolean;
}) {
  const limitH = Math.floor(app.dailyLimitMinutes / 60);
  const limitM = app.dailyLimitMinutes % 60;
  const usedPct =
    app.dailyLimitMinutes > 0
      ? Math.min(100, (app.usedTodayMinutes / app.dailyLimitMinutes) * 100)
      : 0;
  return (
    <li
      className={`rounded-2xl border p-4 transition ${
        app.enabled
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-[20px] shrink-0">{app.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">{app.name}</p>
          <p className="text-[11px] text-tertiary tabular">
            {limitH > 0 ? `${limitH}s ` : ""}
            {limitM}d limit · bugun {app.usedTodayMinutes}d
          </p>
        </div>
        <Toggle checked={app.enabled} onChange={onToggle} />
      </div>
      {app.enabled && !locked && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[11px] text-tertiary mb-2">Kunlik limit</p>
          <div className="flex flex-wrap gap-1.5">
            {[15, 30, 60, 90, 120, 0].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onLimitChange(m)}
                className={`px-3 py-1.5 rounded-lg text-[11px] tabular transition ${
                  app.dailyLimitMinutes === m
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-elevated text-foreground hover:bg-elevated/80"
                }`}
              >
                {m === 0 ? "Cheksiz" : m >= 60 ? `${m / 60}s` : `${m}d`}
              </button>
            ))}
          </div>
          {/* Progress bar */}
          {app.dailyLimitMinutes > 0 && (
            <div className="mt-3 h-1.5 rounded-full bg-elevated overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPct >= 100
                    ? "bg-destructive"
                    : usedPct >= 80
                      ? "bg-amber-500"
                      : "bg-primary"
                }`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// =========================================================
// Yuksalish.dev — brand kartochkasi: ma'lumot, xizmatlar, dasturchi
// =========================================================
const YUKSALISH_SERVICES = [
  {
    icon: Globe,
    title: "Web ilovalar",
    desc: "Zamonaviy, tez va SEO'ga moslangan veb-saytlar",
  },
  {
    icon: Smartphone,
    title: "Mobil ilovalar",
    desc: "Android va iOS uchun native va cross-platform",
  },
  {
    icon: Brain,
    title: "AI yechimlar",
    desc: "Claude, GPT integratsiyasi, custom AI agentlari",
  },
  {
    icon: Code2,
    title: "Backend tizimlar",
    desc: "API, ma'lumotlar bazasi, Cloudflare deploy",
  },
  {
    icon: Palette,
    title: "Brend va UI/UX",
    desc: "Logo, dizayn tizimi, foydalanuvchi tajribasi",
  },
  {
    icon: TrendingUp,
    title: "Marketing va SEO",
    desc: "Trafik, konversiya, ijtimoiy tarmoq strategiyalari",
  },
];

export function YuksalishSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Yuksalish.dev" fullHeight>
      {/* Hero — logo + brand */}
      <div
        className="rounded-2xl p-6 text-center fade-up"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,166,107,0.18), rgba(184,166,107,0.04))",
          border: "1px solid rgba(184,166,107,0.28)",
        }}
      >
        <div className="flex justify-center mb-3">
          <NiyatLogo size={84} rounded={20} />
        </div>
        <p className="font-serif text-[24px] text-foreground leading-tight">
          Yuksalish.dev
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
          Niyat — Yuksalish jamoasi tomonidan ishlab chiqilgan AI hayot
          murabbiyi. Bu shunchaki ilova emas, **tarbiya tizimi**.
        </p>
        <p className="mt-3 text-[11px] text-primary tracking-wider uppercase">
          ✨ Texnologiya × Niyat
        </p>
      </div>

      {/* Mantra */}
      <div className="mt-4 rounded-2xl bg-card border border-border p-5">
        <p className="text-[10px] uppercase tracking-wider text-tertiary mb-2">
          Bizning mantra
        </p>
        <p className="font-serif italic text-[14px] leading-relaxed text-foreground">
          “Biz texnologiyani sotmaymiz — tarbiyani sotamiz. Niyat — bu sizning
          eng yaxshi do'stingiz, eng halol ko'zguyingiz va eng sabrli
          murabbiyingiz.”
        </p>
      </div>

      {/* Xizmatlar */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wider text-tertiary mb-3 px-1">
          Bizning xizmatlar
        </p>
        <ul className="space-y-2">
          {YUKSALISH_SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <li
                key={s.title}
                className="rounded-2xl bg-card border border-border p-4 flex items-start gap-3"
              >
                <span
                  className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(184,166,107,0.12)",
                    border: "1px solid rgba(184,166,107,0.25)",
                  }}
                >
                  <Icon size={16} className="text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-foreground">
                    {s.title}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Loyiha va aloqa — dasturchi profil */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wider text-tertiary mb-3 px-1">
          Loyiha va aloqa
        </p>

        {/* Dasturchi card */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex gap-4">
            {/* Chap: rasm/avatar */}
            <div
              className="h-24 w-24 shrink-0 rounded-2xl overflow-hidden flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(212,184,106,0.20), rgba(122,103,56,0.30))",
                border: "1px solid rgba(184,166,107,0.30)",
              }}
            >
              {/* Agar /dev-photo.jpg fayl mavjud bo'lsa — shu ko'rinadi.
                  Yo'q bo'lsa — initials fallback chiqadi (onError). */}
              <DevPhoto initials="BSh" />
            </div>

            {/* O'ng: nom, role, kontaktlar */}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-primary">
                Full stack dasturchi
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-foreground leading-tight">
                Bekmuhammad Shokirjonov
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-tertiary">
                <Cake size={11} aria-hidden /> 26.01.2006
              </p>
            </div>
          </div>

          {/* Kontakt linklar */}
          <div className="mt-4 space-y-2">
            <DevLink
              href="https://t.me/Khamidov_online"
              icon={<Send size={14} className="text-primary" />}
              label="Telegram (shaxsiy)"
              handle="@Khamidov_online"
            />
            <DevLink
              href="https://t.me/Yuksalishdev_ITjobs"
              icon={<Megaphone size={14} className="text-primary" />}
              label="Yuksalish IT kanali"
              handle="@Yuksalishdev_ITjobs"
            />
            <DevLink
              href="https://www.instagram.com/khamidov__online"
              icon={<Instagram size={14} className="text-primary" />}
              label="Instagram"
              handle="@khamidov__online"
            />
            <DevLink
              href="https://github.com/Bekmuhammad-Devoloper"
              icon={<Github size={14} className="text-primary" />}
              label="GitHub"
              handle="@Bekmuhammad-Devoloper"
            />
          </div>

          {/* Asosiy CTA */}
          <button
            type="button"
            onClick={() => {
              window.open(
                "https://t.me/Khamidov_online",
                "_blank",
                "noopener,noreferrer",
              );
              toast.info("Telegram ochiladi");
            }}
            className="mt-4 w-full py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Send size={14} /> Dasturchiga yozish
          </button>
        </div>
      </div>

      {/* Versiya */}
      <p className="mt-5 mb-2 text-[10px] text-tertiary text-center">
        Niyat MVP 1 · v0.1.0 · {new Date().getFullYear()}
        <br />
        © Yuksalish.dev — Made with ♥ in Toshkent
      </p>
    </BottomSheet>
  );
}

// Yordamchi: dasturchi rasmi (yo'q bo'lsa initials)
function DevPhoto({ initials }: { initials: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <span className="font-serif text-[28px] text-primary tabular">{initials}</span>
    );
  }
  return (
    <img
      src="/developer.image.jpg"
      alt={initials}
      onError={() => setErrored(true)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
      draggable={false}
    />
  );
}

// Yordamchi: kontakt link qatori
function DevLink({
  href,
  icon,
  label,
  handle,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  handle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between px-4 py-3 rounded-xl bg-elevated/60 text-[13px] hover:bg-elevated transition"
    >
      <span className="inline-flex items-center gap-2 min-w-0">
        {icon}
        <span className="flex flex-col items-start min-w-0">
          <span className="text-foreground">{label}</span>
          <span className="text-[11px] text-tertiary truncate">{handle}</span>
        </span>
      </span>
      <ExternalLink size={12} className="text-tertiary shrink-0" />
    </a>
  );
}

// =========================================================
// Help
// =========================================================
export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Yordam">
      <div className="space-y-4 text-[13px]">
        <Section title="Ko'p so'raladigan savollar">
          <Faq q="AI murabbiy real Claude AImi?">
            Ha — agar serverga ANTHROPIC_API_KEY qo'shilgan bo'lsa. Aks holda demo
            javoblar ishlatiladi (header'da "demo rejim" yoziladi).
          </Faq>
          <Faq q="Ma'lumotim qaerda saqlanadi?">
            Hammasi shu brauzeringizning localStorage'ida. Boshqa qurilmaga sinx qilinmaydi.
          </Faq>
          <Faq q="Namoz vaqtlari aniqmi?">
            Aladhan.com API'sidan keladi. Hanafiy madhhab default. Sozlash mumkin.
          </Faq>
          <Faq q="Ovozli xabar qachon qo'shiladi?">
            Brauzer Web Speech API'ni qo'llasa, Murabbiy ekrandagi mic tugma orqali yozib
            ko'ring. Aks holda MVP 2'da to'liq STT.
          </Faq>
        </Section>

        <Section title="Aloqa">
          <p>📧 hello@niyat.app (kelajakda)</p>
          <p className="text-tertiary mt-1">
            MVP versiyasi — fikr-mulohazalaringizni telefon orqali yuboring.
          </p>
        </Section>

        <Section title="Loyiha haqida">
          <p>
            Niyat — Yuksalish Development tomonidan ishlab chiqilgan musulmon yoshlar
            uchun AI hayot murabbiyi. MVP 1 web prototip — Flutter ilovasi yo'lda.
          </p>
        </Section>
      </div>
    </BottomSheet>
  );
}

// =========================================================
// Yearly recap
// =========================================================
export function YearlyRecapSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stats = useStats();
  const { profile } = useUserProfile();
  const year = new Date().getFullYear();

  return (
    <BottomSheet open={open} onClose={onClose} title={`${year} yilingiz`} fullHeight>
      <div className="space-y-4">
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(184,166,107,0.16), rgba(184,166,107,0.04))",
            border: "1px solid rgba(184,166,107,0.25)",
          }}
        >
          <p className="font-serif text-[14px] text-primary mb-2">{profile.firstName}, sen...</p>
          <p className="font-serif text-[44px] tabular text-foreground leading-none">
            {stats.totalTasksCompleted}
          </p>
          <p className="text-[13px] text-muted-foreground mt-2">ta vazifani bajarding</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <RecapTile label="Eng uzun streak" value={`${stats.longestStreak} kun`} />
          <RecapTile label="Joriy streak" value={`${stats.currentStreak} kun`} />
          <RecapTile label="AI bilan suhbat" value={`${stats.totalCoachMessages} xabar`} />
          <RecapTile label="Sadaqa kunlari" value={`${stats.sadaqaDays} kun`} />
          <RecapTile label="Maqsadlar" value={`${stats.completedGoals}/${stats.totalGoals}`} />
          <RecapTile label="O'rtacha progress" value={`${Math.round(stats.averageGoalProgress * 100)}%`} />
        </div>

        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="font-serif italic text-[14px] text-primary">Sening darajang</p>
          <p className="mt-2 font-serif text-[24px] text-foreground">{stats.levelLabel}</p>
          <div className="mt-3 h-1.5 rounded-full bg-elevated overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${stats.levelProgress * 100}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-tertiary tabular">
            {stats.nextLevel}'ga {stats.pointsToNext} ball qoldi
          </p>
        </div>

        <p className="text-center text-[12px] text-tertiary italic font-serif">
          “Amallar niyatlarga qarab baholanadi.”
        </p>
      </div>
    </BottomSheet>
  );
}

function RecapTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 text-center">
      <p className="text-[10px] uppercase tracking-wider text-tertiary">{label}</p>
      <p className="mt-2 text-[18px] font-semibold tabular text-foreground">{value}</p>
    </div>
  );
}

// =========================================================
// New task
// =========================================================
export function NewTaskSheet({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (task: { time: string; label: string }) => void;
}) {
  const [time, setTime] = useState("12:00");
  const [label, setLabel] = useState("");

  const handleSave = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const capitalized = trimmed.charAt(0).toLocaleUpperCase("uz") + trimmed.slice(1);
    onSave({ time, label: capitalized });
    setLabel("");
    setTime("12:00");
    onClose();
    toast.success("Vazifa qo'shildi");
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Yangi vazifa">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="text-[12px] text-tertiary">Nima qilasan?</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(autoCapitalize(e.target.value))}
            placeholder="Masalan: Onaga qo'ng'iroq"
            maxLength={80}
            autoFocus
            autoCapitalize="sentences"
            className="mt-1 w-full bg-card border border-border rounded-xl px-3 py-3 text-[14px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60"
          />
        </label>
        <div>
          <p className="text-[12px] text-tertiary mb-1">Vaqti</p>
          <TimePicker value={time} onChange={setTime} label="Vazifa vaqti" />
        </div>
        <button
          type="submit"
          disabled={!label.trim()}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold disabled:opacity-40"
        >
          Saqlash
        </button>
      </form>
    </BottomSheet>
  );
}

// =========================================================
// Quran player
// =========================================================
// 114 ta surani ko'rish va tanlash uchun sheet.
// Sura bosilganda onSelectSurah'ga uzatiladi — ota komponent MemorizationSheet
// orqali ochib beradi (to'liq oyatlar, audio, lotincha, tarjima bilan).
export function QuranPlayerSheet({
  open,
  onClose,
  onSelectSurah,
}: {
  open: boolean;
  onClose: () => void;
  onSelectSurah: (surah: { id: string; number: number; arabic: string; latin: string }) => void;
}) {
  const { data: chapters, isLoading, isError } = useQuranChapters();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!chapters) return [];
    const q = search.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter(
      (c) =>
        c.nameLatin.toLowerCase().includes(q) ||
        c.nameArabic.includes(q) ||
        String(c.id) === q,
    );
  }, [chapters, search]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Qur'on suralari" fullHeight>
      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sura nomini yoki raqamini qidiring..."
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 transition"
        />

        {isLoading && (
          <div className="rounded-2xl bg-card border border-border p-6 text-center">
            <p className="text-[13px] text-tertiary">Suralar yuklanyapti...</p>
          </div>
        )}
        {isError && (
          <div className="rounded-2xl bg-card border border-destructive/40 p-5 text-center">
            <p className="text-[13px] text-destructive">
              Suralar ro'yxati yuklanmadi. Internet aloqasini tekshiring.
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <>
            <p className="text-[11px] text-tertiary tabular">
              {search.trim() ? `Topildi: ${filtered.length}` : `Jami: ${filtered.length} sura`}
            </p>
            <ul className="space-y-1.5">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSurah({
                        id: `surah-${c.id}`,
                        number: c.id,
                        arabic: c.nameArabic,
                        latin: c.nameLatin,
                      });
                    }}
                    className="w-full rounded-xl bg-card border border-border hover:border-primary/40 transition p-3.5 text-left active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 h-9 w-9 rounded-lg bg-primary/10 text-primary text-[12px] tabular font-semibold inline-flex items-center justify-center">
                        {c.id}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[14px] font-semibold text-foreground truncate">
                            {c.nameLatin}
                          </p>
                          <p
                            className="font-arabic text-quran text-[18px] text-primary shrink-0"
                            dir="rtl"
                          >
                            {c.nameArabic}
                          </p>
                        </div>
                        <p className="text-[10px] text-tertiary mt-0.5 tabular">
                          {c.versesCount} oyat ·{" "}
                          {c.revelationPlace === "makkah" ? "Makka" : "Madina"}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

// =========================================================
// Memorization (sura recitation)
// =========================================================
export function MemorizationSheet({
  open,
  onClose,
  surah,
}: {
  open: boolean;
  onClose: () => void;
  surah: { id: string; number?: number; arabic: string; latin: string } | null;
}) {
  // Tanlangan qori — localStorage'da saqlanadi
  const [reciterId, setReciterId] = useLocalState<number>(
    "niyat:quran:reciterId",
    DEFAULT_RECITER_ID,
  );
  const [reciterPickerOpen, setReciterPickerOpen] = useState(false);
  const { data: reciters } = useReciters();
  // Quran.com'dan to'liq oyatlar va tilovat (faqat number bo'lsa)
  const { verses, audio, isLoading, isError } = useQuranSurah(
    surah?.number ?? null,
    { reciterId },
  );
  // Global player — sheet yopilsa ham audio davom etadi
  const player = useQuranPlayer();
  const isThisSurahPlaying =
    player.isPlaying && player.surah?.number === surah?.number;

  if (!surah) return null;

  // Tanlangan qori nomi — reciters ro'yxatidan yoki POPULAR'dan
  const allReciters = reciters && reciters.length > 0 ? reciters : POPULAR_RECITERS;
  const currentReciter =
    allReciters.find((r) => r.id === reciterId) ?? POPULAR_RECITERS[0];
  const reciterDisplayName = currentReciter.style
    ? `${currentReciter.name} · ${currentReciter.style}`
    : currentReciter.name;

  const togglePlay = () => {
    if (!audio) return;
    // Yangi sura yoki yangi qori → audio'ni qaytadan boshlash
    const isDifferentTrack =
      player.surah?.number !== surah.number ||
      player.surah?.reciterName !== currentReciter.name;
    if (isDifferentTrack) {
      player.play(audio.audioUrl, {
        number: surah.number ?? 0,
        arabic: surah.arabic,
        latin: surah.latin,
        reciterName: currentReciter.name,
      });
      return;
    }
    // Shu sura va shu qori ijroda — pauza/davom
    if (player.isPlaying) {
      player.pause();
    } else {
      player.resume();
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`${surah.latin} — yodlash`} fullHeight>
      <div className="space-y-4">
        {/* Surah sarlavhasi */}
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(184,166,107,0.10), rgba(184,166,107,0.03))",
            border: "1px solid rgba(184,166,107,0.18)",
          }}
        >
          <p className="font-arabic text-quran text-[36px] leading-snug" dir="rtl">
            {surah.arabic}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {surah.latin}
            {surah.number ? ` · ${surah.number}-sura` : ""}
            {verses.length > 0 ? ` · ${verses.length} oyat` : ""}
          </p>
        </div>

        {/* Audio (tilovat) player */}
        {audio && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wider text-tertiary">
                  Tilovat
                </p>
                <button
                  type="button"
                  onClick={() => setReciterPickerOpen((v) => !v)}
                  className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-foreground hover:text-primary transition group"
                  aria-expanded={reciterPickerOpen}
                >
                  <span className="truncate font-semibold">{reciterDisplayName}</span>
                  <ChevronRight
                    size={12}
                    className={`text-tertiary transition-transform ${
                      reciterPickerOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>
                <p className="text-[10px] text-tertiary mt-0.5">
                  Ilovani yopsangiz ham davom etadi
                </p>
              </div>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isThisSurahPlaying ? "To'xtatish" : "Eshitish"}
                className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition shrink-0"
              >
                {isThisSurahPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
              </button>
            </div>

            {/* Qori tanlash ro'yxati — bosilganda ochiladi */}
            {reciterPickerOpen && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-tertiary mb-2">
                  Qori tanlang
                </p>
                <ul className="space-y-1 max-h-64 overflow-y-auto scrollbar-hide">
                  {allReciters.map((r) => {
                    const isActive = r.id === reciterId;
                    const label = r.style ? `${r.name} · ${r.style}` : r.name;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setReciterId(r.id);
                            setReciterPickerOpen(false);
                            // Agar shu sura hozir ijro etilayotgan bo'lsa — to'xtatamiz
                            // (yangi qori URL'i kelganda foydalanuvchi qaytadan Play bosadi)
                            if (
                              player.surah?.number === surah.number &&
                              player.isPlaying
                            ) {
                              player.stop();
                            }
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition flex items-center justify-between gap-2 ${
                            isActive
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground hover:bg-elevated"
                          }`}
                        >
                          <span className="truncate">{label}</span>
                          {isActive && <Check size={14} className="shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Sura matni — 3 ta blok: arabcha, lotin transliteratsiyasi, o'zbekcha */}
        {isLoading && (
          <div className="rounded-2xl bg-card border border-border p-6 text-center">
            <p className="text-[13px] text-tertiary">Sura yuklanyapti...</p>
          </div>
        )}
        {isError && (
          <div className="rounded-2xl bg-card border border-destructive/40 p-5 text-center">
            <p className="text-[13px] text-destructive">
              Sura yuklanmadi. Internet aloqasini tekshiring.
            </p>
          </div>
        )}
        {!isLoading && !isError && verses.length > 0 && (
          <>
            {/* Arabcha — butun sura matni */}
            <div className="rounded-2xl bg-card border border-border p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-primary mb-3">
                Arabcha
              </p>
              <p
                className="font-arabic text-quran text-[22px] leading-[2.05] text-right text-foreground"
                dir="rtl"
              >
                {verses.map((v) => `${v.arabic} ۝${v.verseNumber}`).join(" ")}
              </p>
            </div>

            {/* Lotin transliteratsiyasi */}
            {verses.some((v) => v.transliteration) && (
              <div className="rounded-2xl bg-card border border-border p-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-primary mb-3">
                  Lotincha yozilishi
                </p>
                <p className="text-[15px] leading-[1.9] text-foreground font-serif italic">
                  {verses
                    .map((v) => v.transliteration)
                    .filter(Boolean)
                    .join(" ")}
                </p>
              </div>
            )}

            {/* O'zbekcha tarjima */}
            <div className="rounded-2xl bg-card border border-border p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-primary mb-3">
                O'zbekcha ma'nosi
              </p>
              <p className="text-[15px] leading-[1.85] text-foreground font-serif">
                {verses
                  .map((v) => v.translation)
                  .filter(Boolean)
                  .join(" ")}
              </p>
            </div>
          </>
        )}

      </div>
    </BottomSheet>
  );
}

// =========================================================
// Sadaqa log
// =========================================================
export function SadaqaSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (description: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <BottomSheet open={open} onClose={onClose} title="Sadaqa qo'shish">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = text.trim();
          if (!trimmed) return;
          const cap = trimmed.charAt(0).toLocaleUpperCase("uz") + trimmed.slice(1);
          onAdd(cap);
          setText("");
          onClose();
          toast.success("Sadaqa bayonoti qo'shildi");
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="text-[12px] text-tertiary">Nima sadaqa qildingiz?</span>
          <textarea
            value={text}
            onChange={(e) => setText(autoCapitalize(e.target.value))}
            placeholder="Masalan: 5000 so'm, tilanchiga, peshindan keyin..."
            maxLength={240}
            rows={3}
            autoFocus
            autoCapitalize="sentences"
            className="mt-1 w-full bg-card border border-border rounded-xl px-3 py-3 text-[14px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 resize-none"
          />
        </label>
        <p className="text-[11px] text-tertiary font-serif italic">
          "Eng yaxshi sadaqa — yashirin qilingan sadaqa."
        </p>
        <button
          type="submit"
          disabled={!text.trim()}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-40"
        >
          Saqlash
        </button>
      </form>
    </BottomSheet>
  );
}

// =========================================================
// Reusable bits
// =========================================================
export function MenuRow({
  icon,
  label,
  onClick,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  subtitle?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between px-5 py-3.5 text-[14px] text-foreground hover:bg-elevated/50 transition"
      >
        <span className="inline-flex items-center gap-3">
          <span className="text-primary">{icon}</span>
          <span className="flex flex-col items-start">
            <span>{label}</span>
            {subtitle && <span className="text-[11px] text-tertiary">{subtitle}</span>}
          </span>
        </span>
        <ChevronRight size={16} className="text-tertiary" />
      </button>
    </li>
  );
}

function Row({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-[14px] text-foreground">{title}</p>
          {subtitle && <p className="text-[11px] text-tertiary mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition shrink-0 ${
        checked ? "bg-primary" : "bg-elevated border border-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-wider text-tertiary mb-2">{title}</p>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-card border border-border mb-2 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-3 text-[13px] font-semibold text-foreground flex justify-between items-center"
      >
        {q}
        <ChevronRight size={14} className={`text-tertiary transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3 text-[12px] text-muted-foreground">{children}</div>}
    </div>
  );
}

// =========================================================
// Bugungi Sunnat — Sahihi Buxoriy 1-jildning to'liq tarkibidan
// =========================================================
export function SunnatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    today,
    pool,
    appliedToday,
    streak,
    appliedDays,
    isLoading,
    total,
    markApplied,
    unmark,
  } = useSunnat();
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<SunnatCategory | "all">("all");
  // AI orqali soddalashtirish — har sunnat uchun bir martalik, cache'lanadi
  const simplifier = useSunnatSimplify(today?.id ?? null);
  const [showOriginal, setShowOriginal] = useState(false);

  // Sahifa o'lchami va virtualizatsiya o'rniga oddiy slice (MVP)
  const VISIBLE = 100;
  const [visibleCount, setVisibleCount] = useState(VISIBLE);

  const filtered = useMemo(() => {
    if (!pool.length) return [];
    const q = search.trim().toLowerCase();
    return pool.filter((s) => {
      if (filterCat !== "all" && s.category !== filterCat) return false;
      if (q && !s.title.toLowerCase().includes(q) && !s.practice.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [pool, search, filterCat]);

  // Filterda mavjud kategoriyalar
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of pool) counts[s.category] = (counts[s.category] || 0) + 1;
    return counts;
  }, [pool]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Bugungi sunnat" fullHeight>
      {isLoading || !today ? (
        <div className="py-10 text-center">
          <p className="text-[13px] text-tertiary">Sahihi Buxoriy yuklanyapti...</p>
        </div>
      ) : (
        <>
          {/* Hero — bob sarlavhasi, kitobdagidek */}
          <div
            className="rounded-2xl p-5 fade-up"
            style={{
              background:
                "linear-gradient(135deg, rgba(184,166,107,0.16), rgba(184,166,107,0.04))",
              border: "1px solid rgba(184,166,107,0.25)",
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] tracking-[0.18em] uppercase text-primary">
                {CATEGORY_LABELS[today.category]}
                {today.book ? ` · ${today.book}` : ""}
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] tabular text-primary">
                <Flame size={11} fill="currentColor" /> {streak} kun
              </span>
            </div>
            <h3 className="mt-3 font-serif text-[20px] leading-tight text-foreground">
              {today.chapterNumber}-bob. {today.title}
            </h3>
            <p className="mt-2 text-[11px] text-muted-foreground italic">
              Sahihi Buxoriy, 1-jild
            </p>
          </div>

          {/* Hadis matni — to'liq, kitobdagidek paragraflar bilan.
              "Soddalashtir" tugmasi orqali AI zamonaviy tilda tushuntirib beradi. */}
          <div className="mt-4 rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-wider text-tertiary">
                {simplifier.simplified && !showOriginal
                  ? "Zamonaviy tushuntirish"
                  : "Hadis matni"}
              </p>
              {simplifier.simplified ? (
                <button
                  type="button"
                  onClick={() => setShowOriginal((v) => !v)}
                  className="text-[11px] text-primary hover:text-primary/80 transition inline-flex items-center gap-1"
                >
                  {showOriginal ? (
                    <>
                      <Sparkles size={11} /> Zamonaviy
                    </>
                  ) : (
                    <>Asl matn</>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => simplifier.simplify(today)}
                  disabled={simplifier.isLoading}
                  className="text-[11px] text-primary hover:text-primary/80 disabled:opacity-50 transition inline-flex items-center gap-1"
                >
                  <Sparkles size={11} />
                  {simplifier.isLoading ? "Yozyapti..." : "Soddalashtir"}
                </button>
              )}
            </div>
            <div className="space-y-3 text-[14.5px] leading-[1.75] text-foreground font-serif">
              {(simplifier.simplified && !showOriginal
                ? simplifier.simplified
                : today.fullText ?? today.context
              )
                .split(/\n\n+/)
                .map((para, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {para}
                  </p>
                ))}
            </div>
            {simplifier.error && (
              <p className="mt-2 text-[11px] text-destructive">
                Soddalashtirib bo'lmadi: {simplifier.error}
              </p>
            )}
          </div>

          {/* Action */}
          <div className="mt-4">
            {appliedToday ? (
              <div className="rounded-2xl bg-primary/10 border border-primary/30 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-primary" />
                  <p className="text-[13px] text-foreground">Bugun amalga oshirildi</p>
                </div>
                <button
                  type="button"
                  onClick={unmark}
                  className="text-[12px] text-tertiary hover:text-destructive transition"
                >
                  Bekor qilish
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  markApplied(today);
                  toast.success("Sunnat amalga oshirildi");
                }}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                <Check size={16} /> Bajardim
              </button>
            )}
          </div>

          {/* Statistika */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-card border border-border p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-tertiary">
                Joriy streak
              </p>
              <p className="mt-2 text-[20px] font-semibold tabular text-foreground">
                {streak}
              </p>
            </div>
            <div className="rounded-2xl bg-card border border-border p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-tertiary">
                Bajarilgan
              </p>
              <p className="mt-2 text-[20px] font-semibold tabular text-foreground">
                {appliedDays}
              </p>
            </div>
          </div>

          {/* Barcha sunnatlar (search + filter) */}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full flex items-center justify-between py-3 text-[13px] text-foreground"
            >
              <span className="inline-flex items-center gap-2">
                <BookOpen size={14} className="text-primary" />
                Sahihi Buxoriy 1-jild ({total} bob)
              </span>
              <ChevronRight
                size={14}
                className={`text-tertiary transition-transform ${showAll ? "rotate-90" : ""}`}
              />
            </button>

            {showAll && (
              <>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setVisibleCount(VISIBLE);
                  }}
                  placeholder="Sarlavhada qidirish..."
                  className="w-full mt-2 bg-card border border-border rounded-xl px-3 py-2.5 text-[14px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60"
                />

                {/* Category filter chips */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <FilterChip
                    label={`Hammasi (${pool.length})`}
                    active={filterCat === "all"}
                    onClick={() => {
                      setFilterCat("all");
                      setVisibleCount(VISIBLE);
                    }}
                  />
                  {(Object.keys(CATEGORY_LABELS) as SunnatCategory[]).map((k) => {
                    const count = catCounts[k] ?? 0;
                    if (count === 0) return null;
                    return (
                      <FilterChip
                        key={k}
                        label={`${CATEGORY_LABELS[k]} (${count})`}
                        active={filterCat === k}
                        onClick={() => {
                          setFilterCat(k);
                          setVisibleCount(VISIBLE);
                        }}
                      />
                    );
                  })}
                </div>

                <p className="mt-3 text-[11px] text-tertiary">
                  Topildi: {filtered.length} ta bob
                </p>

                <ul className="mt-2 space-y-2">
                  {filtered.slice(0, visibleCount).map((s) => (
                    <li
                      key={s.id}
                      className={`rounded-xl border p-3 text-[13px] ${
                        s.id === today.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-foreground font-semibold flex-1 leading-snug">
                          {s.chapterNumber}-bob. {s.title}
                        </p>
                        <span className="text-[9px] uppercase tracking-wider text-tertiary shrink-0 mt-1">
                          {CATEGORY_LABELS[s.category]}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed line-clamp-3">
                        {s.practice}
                      </p>
                    </li>
                  ))}
                </ul>

                {filtered.length > visibleCount && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((v) => v + VISIBLE)}
                    className="mt-3 w-full py-2.5 rounded-xl bg-elevated text-foreground text-[13px] hover:bg-elevated/70 transition"
                  >
                    Yana {Math.min(VISIBLE, filtered.length - visibleCount)} ta yuklash
                  </button>
                )}
              </>
            )}
          </div>

          <p className="mt-5 text-[11px] text-tertiary text-center font-serif italic">
            “Kim mening sunnatimni tiriltirsa, meni sevgan bo'ladi.”
            <br />— Tirmiziy
          </p>
        </>
      )}
    </BottomSheet>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] transition ${
        active
          ? "bg-primary text-primary-foreground font-semibold"
          : "bg-card border border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

// =========================================================
// Asma ul-Husna — Allohning 99 go'zal ismini yodlash
// =========================================================
export function AsmaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const asma = useAsmaProgress();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "done" | "todo">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return asma.all.filter((a) => {
      if (filter === "done" && !asma.isMemorized(a.number)) return false;
      if (filter === "todo" && asma.isMemorized(a.number)) return false;
      if (
        q &&
        !a.latin.toLowerCase().includes(q) &&
        !a.meaning.toLowerCase().includes(q) &&
        !String(a.number).includes(q)
      )
        return false;
      return true;
    });
  }, [search, filter, asma]);

  const progressPct = Math.round((asma.count / asma.total) * 100);

  return (
    <BottomSheet open={open} onClose={onClose} title="Allohning 99 go'zal ismi" fullHeight>
      {/* Progress hero */}
      <div
        className="rounded-2xl p-5"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,166,107,0.16), rgba(184,166,107,0.04))",
          border: "1px solid rgba(184,166,107,0.25)",
        }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-[0.18em] uppercase text-primary">Asma ul-Husna</p>
          <span className="text-[12px] tabular text-primary font-semibold">
            {asma.count}/{asma.total}
          </span>
        </div>
        <p className="mt-3 font-arabic text-quran text-[26px] leading-tight text-right" dir="rtl">
          أَسْمَاءُ ٱللَّهِ ٱلْحُسْنَىٰ
        </p>
        <div className="mt-4 h-1.5 rounded-full bg-elevated overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {progressPct}% yodlandi — {asma.total - asma.count} ta qoldi
        </p>
        {asma.nextToMemorize && (
          <div className="mt-3 pt-3 border-t border-primary/20">
            <p className="text-[10px] uppercase tracking-wider text-tertiary">Keyingi ism</p>
            <p className="mt-1 font-arabic text-quran text-[18px] text-right" dir="rtl">
              {asma.nextToMemorize.arabic}
            </p>
            <p className="text-[14px] font-semibold text-foreground mt-1">
              {asma.nextToMemorize.number}. {asma.nextToMemorize.latin}
            </p>
            <p className="text-[12px] text-muted-foreground">{asma.nextToMemorize.meaning}</p>
          </div>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Qidirish (ism yoki ma'no)..."
        className="w-full mt-4 bg-card border border-border rounded-xl px-3 py-2.5 text-[14px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60"
      />

      {/* Filter chips */}
      <div className="mt-3 flex gap-2">
        <FilterChip
          label={`Hammasi (${asma.total})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <FilterChip
          label={`Yodlanmagan (${asma.total - asma.count})`}
          active={filter === "todo"}
          onClick={() => setFilter("todo")}
        />
        <FilterChip
          label={`Yodlangan (${asma.count})`}
          active={filter === "done"}
          onClick={() => setFilter("done")}
        />
      </div>

      <p className="mt-3 text-[11px] text-tertiary">Topildi: {filtered.length} ta</p>

      {/* List */}
      <ul className="mt-2 space-y-2">
        {filtered.map((a) => {
          const done = asma.isMemorized(a.number);
          return (
            <li
              key={a.number}
              className={`rounded-xl border p-4 transition ${
                done
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-[11px] tabular text-tertiary mt-1 shrink-0">
                    {a.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-arabic text-quran text-[22px] leading-tight text-right"
                      dir="rtl"
                    >
                      {a.arabic}
                    </p>
                    <p
                      className={`text-[14px] font-semibold mt-1.5 ${
                        done ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {a.latin}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                      {a.meaning}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => asma.toggle(a.number)}
                  aria-label={done ? "Yodlanganni bekor qilish" : "Yodladim"}
                  className={`shrink-0 h-7 w-7 rounded-md inline-flex items-center justify-center transition ${
                    done
                      ? "bg-primary text-primary-foreground"
                      : "border border-tertiary text-tertiary hover:border-primary hover:text-primary"
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {asma.count > 0 && (
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                `Yodlangan ${asma.count} ta ismni nolla? (progress qaytadan boshlanadi)`,
              )
            ) {
              asma.reset();
              toast.info("Progress nollandi");
            }
          }}
          className="mt-5 w-full py-2.5 rounded-xl text-[12px] text-tertiary hover:text-destructive transition"
        >
          Yodlash progressini nollash
        </button>
      )}

      <p className="mt-5 text-[11px] text-tertiary text-center font-serif italic">
        “Allohning go'zal ismlari bor — uni shu ismlar bilan chaqiringlar.”
        <br />— Qur'on, A'rof 180
      </p>
    </BottomSheet>
  );
}

// =========================================================
// Ekran vaqti — manual kiritish + tushuntirish
// =========================================================
export function ScreenTimeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useAppTime();
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  // Sheet ochilganda joriy qiymatdan boshlash
  useEffect(() => {
    if (!open) return;
    const total = t.todayMin;
    setHours(Math.floor(total / 60));
    setMinutes(total % 60);
  }, [open, t.todayMin]);

  const save = () => {
    const total = hours * 60 + minutes;
    t.setManual(total);
    toast.success("Ekran vaqti saqlandi");
    onClose();
  };

  const clearManual = () => {
    t.setManual(null);
    toast.info("Avtomatik (ilova sessiyasi) qaytarildi");
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Ekran vaqti">
      <div className="space-y-4">
        {/* Tushuntirish */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-[13px] text-foreground leading-relaxed">
            Web brauzer butun telefon ekran vaqtini avtomatik aniqlay olmaydi —
            bu faqat native Android/iOS ilovada (MVP 2'da) mumkin bo'ladi.
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
            Hozir telefon sozlamalaridan ko'rib, qo'lda kiriting. Yoki ilova
            avtomatik hisoblagan sessiya vaqtidan foydalaning.
          </p>
        </div>

        {/* Joriy qiymat */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-[10px] uppercase tracking-wider text-tertiary">
            Joriy ko'rinish
          </p>
          <p className="mt-1 text-[22px] font-semibold tabular text-foreground">
            {t.formatted}{" "}
            <span className="text-[11px] font-normal text-tertiary">
              ({t.isManual ? "qo'lda" : "avtomatik"})
            </span>
          </p>
          {!t.isManual && (
            <p className="mt-1 text-[11px] text-tertiary">
              Bu — ilova sessiyasi vaqti, telefonning butun ekran vaqti emas.
            </p>
          )}
        </div>

        {/* Manual input */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-[12px] text-tertiary mb-3">
            Telefon ekran vaqtini kiriting
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase text-tertiary mb-1">Soat</p>
              <input
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) =>
                  setHours(Math.max(0, Math.min(24, Number(e.target.value) || 0)))
                }
                className="w-full bg-background/40 border border-border rounded-lg px-3 py-2.5 text-[16px] text-foreground tabular outline-none focus:border-primary/60"
              />
            </div>
            <span className="text-[20px] text-tertiary pb-2">:</span>
            <div className="flex-1">
              <p className="text-[10px] uppercase text-tertiary mb-1">Daqiqa</p>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) =>
                  setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
                }
                className="w-full bg-background/40 border border-border rounded-lg px-3 py-2.5 text-[16px] text-foreground tabular outline-none focus:border-primary/60"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={hours === 0 && minutes === 0}
            className="mt-4 w-full py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold disabled:opacity-40 active:scale-[0.98] transition"
          >
            Saqlash
          </button>
          {t.isManual && (
            <button
              type="button"
              onClick={clearManual}
              className="mt-2 w-full py-2.5 text-[12px] text-tertiary hover:text-foreground transition"
            >
              Avtomatik (ilova sessiyasi) ga qaytarish
            </button>
          )}
        </div>

        <p className="text-[11px] text-tertiary text-center font-serif italic">
          “Vaqt — Allohning ne'mati, behuda sarflama.”
        </p>
      </div>
    </BottomSheet>
  );
}

// Re-export icon types for downstream consumers if needed
export { Bell, Shield, CreditCard, HelpCircle, Sparkles, Volume2 };
