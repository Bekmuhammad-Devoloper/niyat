import { useState } from "react";
import { LogOut, Sparkles, Bell, MoonStar, Volume2, Shield, CreditCard, HelpCircle, Code2, BadgeCheck, ShieldAlert, Cloud, X } from "lucide-react";
import { toast } from "sonner";
import { profile } from "@/lib/niyat-data";
import { useUserProfile, formatPhone, isPremiumActive, premiumDaysLeft } from "@/lib/hooks/use-user-profile";
import { useStats } from "@/lib/hooks/use-stats";
import { useAuthApi, isAuthError } from "@/lib/hooks/use-auth-api";
import { useBackendSyncCheck } from "@/lib/hooks/use-backend-sync-check";
import { AI_PERSONALITIES } from "@/lib/settings";
import { useSettings } from "@/lib/hooks/use-settings";
import { ProfileAvatar } from "../ProfileAvatar";
import {
  AIPersonalitySheet,
  NotificationsSheet,
  PrayerSettingsSheet,
  VoiceSettingsSheet,
  PrivacySheet,
  PremiumSheet,
  HelpSheet,
  YearlyRecapSheet,
  YuksalishSheet,
  AppBlockSheet,
  MenuRow,
} from "../sheets";


type SheetKey =
  | "ai"
  | "notif"
  | "prayer"
  | "voice"
  | "appblock"
  | "privacy"
  | "premium"
  | "yuksalish"
  | "help"
  | "year"
  | null;

export function MeScreen() {
  const { profile: user, setProfile } = useUserProfile();
  const stats = useStats();
  const { settings } = useSettings();
  const [open, setOpen] = useState<SheetKey>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const close = () => setOpen(null);
  const { isSynced, refresh: refreshSync } = useBackendSyncCheck();

  const displayName =
    user.firstName === "do'st"
      ? profile.name
      : `${user.firstName}${user.lastName ? " " + user.lastName : ""}`;

  // Bosh harflar — agar rasm yo'q bo'lsa
  const initials = (() => {
    const first = user.firstName !== "do'st" ? user.firstName.charAt(0) : "";
    const last = user.lastName ? user.lastName.charAt(0) : "";
    const result = (first + last).toUpperCase();
    return result || "N";
  })();
  const aiLabel =
    AI_PERSONALITIES.find((p) => p.key === settings.aiPersonality)?.label ?? "Muvozanatli";

  return (
    <div className="h-full overflow-y-auto scrollbar-hide pb-24">
      <div className="px-6 pt-6 flex items-center gap-4 fade-up">
        <ProfileAvatar
          photoDataUrl={user.photoDataUrl}
          initials={initials}
          size={72}
          editable
          onChange={(url) => setProfile({ ...user, photoDataUrl: url })}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[18px] font-semibold text-foreground inline-flex items-center gap-1.5">
            {displayName}
            {user.phoneVerified && (
              <BadgeCheck
                size={14}
                className="text-primary shrink-0"
                aria-label="Tasdiqlangan"
              />
            )}
          </p>
          {user.phone && (
            <p className="text-[11px] text-tertiary tabular">
              {formatPhone(user.phone)}
            </p>
          )}
          <p className="text-[12px] text-primary mt-0.5">{stats.levelLabel}</p>
          <div
            className="mt-2 h-1.5 w-40 rounded-full bg-elevated overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(stats.levelProgress * 100)}
            aria-label="Daraja progressi"
          >
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${stats.levelProgress * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-tertiary mt-1 tabular">
            {stats.nextLevel} ga {stats.pointsToNext} ball
          </p>
        </div>
      </div>

      {/* Backend sync banner — hisob server'ga bog'lanmagan bo'lsa */}
      {!isSynced && (
        <button
          type="button"
          onClick={() => setSyncOpen(true)}
          className="mx-6 mt-4 w-[calc(100%-3rem)] rounded-2xl border border-primary/40 bg-primary/10 p-3 text-left hover:bg-primary/15 transition flex items-start gap-2.5 active:scale-[0.99]"
        >
          <Cloud size={16} className="text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground">
              Hisobingiz markaziy serverga bog'lanmagan
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Bog'lasangiz boshqa qurilmada ham kira olasiz va admin
              foydalanuvchilar ro'yxatida ko'rinasiz. Bosing →
            </p>
          </div>
        </button>
      )}

      {/* Stats grid — endi real */}
      <div className="px-6 mt-6 grid grid-cols-2 gap-2.5">
        <StatCard label="Eng uzun streak" value={`${stats.longestStreak} kun`} />
        <StatCard label="Joriy streak" value={`${stats.currentStreak} kun`} />
        <StatCard label="Bajarilgan vazifalar" value={`${stats.totalTasksCompleted}`} />
        <StatCard label="AI suhbat" value={`${stats.totalCoachMessages} xabar`} />
        <StatCard label="Sadaqa kunlari" value={`${stats.sadaqaDays}`} />
        <StatCard label="Maqsadlar progressi" value={`${Math.round(stats.averageGoalProgress * 100)}%`} />
      </div>

      {/* Yillik xulosa */}
      <button
        type="button"
        onClick={() => setOpen("year")}
        aria-label="Yillik xulosani ochish"
        className="mx-6 mt-5 rounded-2xl p-5 flex items-center justify-between w-[calc(100%-3rem)] text-left active:scale-[0.99] transition fade-up"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,166,107,0.16), rgba(184,166,107,0.04))",
          border: "1px solid rgba(184,166,107,0.25)",
        }}
      >
        <div>
          <p className="text-[11px] uppercase tracking-wider text-primary">Yillik xulosa</p>
          <p className="mt-1 font-serif text-[20px] text-foreground">
            {new Date().getFullYear()} yilingiz hozircha...
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Wrapped-style hisobot</p>
        </div>
        <span className="font-serif text-[44px] text-primary/40 leading-none tabular">
          {String(new Date().getFullYear()).slice(2)}
        </span>
      </button>

      {/* Menu */}
      <ul className="mx-6 mt-5 rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        <MenuRow icon={<Sparkles size={16} />} label="AI shaxsiyati" subtitle={aiLabel} onClick={() => setOpen("ai")} />
        <MenuRow icon={<Bell size={16} />} label="Bildirishnomalar" subtitle={settings.notifications.prayerReminders ? "Yoqilgan" : "O'chirilgan"} onClick={() => setOpen("notif")} />
        <MenuRow icon={<MoonStar size={16} />} label="Namoz sozlamalari" subtitle={`${settings.madhhab === "hanafi" ? "Hanafiy" : "Shofe'iy"}${settings.location ? " · joylashuv" : " · Toshkent"}`} onClick={() => setOpen("prayer")} />
        <MenuRow icon={<Volume2 size={16} />} label="Ovoz va til" subtitle={settings.voice.ttsEnabled ? "TTS yoqilgan" : "TTS o'chirilgan"} onClick={() => setOpen("voice")} />
        <MenuRow icon={<ShieldAlert size={16} />} label="Ilova nazorati" subtitle="Vaqt o'g'rilarini bloklash" onClick={() => setOpen("appblock")} />
        <MenuRow icon={<Shield size={16} />} label="Maxfiylik" onClick={() => setOpen("privacy")} />
        <MenuRow
          icon={<CreditCard size={16} />}
          label="Premium obuna"
          subtitle={
            user.isPremium
              ? "Aktiv · doimiy"
              : isPremiumActive(user)
                ? `Sovg'a · ${premiumDaysLeft(user)} kun qoldi`
                : "$5/oy"
          }
          onClick={() => setOpen("premium")}
        />
        <MenuRow
          icon={<Code2 size={16} />}
          label="Yuksalish.dev"
          subtitle="Bizning xizmatlar va aloqa"
          onClick={() => setOpen("yuksalish")}
        />
        <MenuRow icon={<HelpCircle size={16} />} label="Yordam" onClick={() => setOpen("help")} />
      </ul>

      <button
        type="button"
        onClick={() => {
          if (
            confirm(
              "Hisobdan chiqasizmi? Telefon va parol saqlanadi — qaytib kirish uchun shularni ishlatasiz.",
            )
          ) {
            setProfile({ ...user, loggedIn: false });
            toast.info("Hisobdan chiqildi");
          }
        }}
        className="mt-5 mx-auto flex items-center gap-2 text-[12px] text-tertiary py-2 hover:text-foreground transition"
      >
        <LogOut size={13} /> Chiqish
      </button>

      <AIPersonalitySheet open={open === "ai"} onClose={close} />
      <NotificationsSheet open={open === "notif"} onClose={close} />
      <PrayerSettingsSheet open={open === "prayer"} onClose={close} />
      <VoiceSettingsSheet open={open === "voice"} onClose={close} />
      <AppBlockSheet open={open === "appblock"} onClose={close} />
      <PrivacySheet open={open === "privacy"} onClose={close} />
      <PremiumSheet open={open === "premium"} onClose={close} />
      <YuksalishSheet open={open === "yuksalish"} onClose={close} />
      <HelpSheet open={open === "help"} onClose={close} />
      <YearlyRecapSheet open={open === "year"} onClose={close} />

      {syncOpen && (
        <BackendSyncModal
          firstName={user.firstName}
          lastName={user.lastName}
          phone={user.phone}
          onClose={() => setSyncOpen(false)}
          onSynced={() => {
            setSyncOpen(false);
            refreshSync();
            toast.success("Hisob serverga bog'landi");
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <p className="text-[10px] uppercase tracking-wider text-tertiary">{label}</p>
      <p className="mt-2 text-[18px] font-semibold tabular text-foreground">{value}</p>
    </div>
  );
}

// Modal — parol kiritib hisobni server'ga register qilish
function BackendSyncModal({
  firstName,
  lastName,
  phone,
  onClose,
  onSynced,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  onClose: () => void;
  onSynced: () => void;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const auth = useAuthApi();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    try {
      try {
        await auth.register({ firstName, lastName, phone, password });
        onSynced();
        return;
      } catch (err) {
        if (isAuthError(err) && err.status === 409) {
          // Allaqachon ro'yxatda — login bilan urinib ko'ramiz
          try {
            await auth.login({ phone, password });
            onSynced();
            return;
          } catch {
            toast.error("Parol noto'g'ri yoki backend xato");
            return;
          }
        }
        if (isAuthError(err) && err.backendDown) {
          toast.error("Server javob bermayapti");
          return;
        }
        toast.error(err instanceof Error ? err.message : "Xato");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-foreground">
              Serverga bog'lash
            </h2>
            <p className="text-[12px] text-tertiary mt-1 leading-relaxed">
              Hisobingizni boshqa qurilmalarda ham ishlatish va e'lonlar olish
              uchun parolingizni tasdiqlang.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="text-tertiary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="rounded-lg bg-elevated p-3 text-[12px]">
            <p className="text-tertiary">Hisob:</p>
            <p className="text-foreground mt-1">
              {firstName} {lastName} · {formatPhone(phone)}
            </p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parolingiz"
            autoFocus
            autoComplete="current-password"
            className="w-full bg-elevated border border-border rounded-lg px-3 py-2.5 text-[14px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60"
          />
          <button
            type="submit"
            disabled={!password || submitting}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold disabled:opacity-50 transition"
          >
            {submitting ? "Sinxronlanmoqda..." : "Server'ga bog'lash"}
          </button>
        </form>
      </div>
    </div>
  );
}
