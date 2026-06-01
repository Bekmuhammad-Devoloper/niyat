import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  MessageCircle,
  Volume2,
  DollarSign,
  Activity,
  Target,
  Sparkles,
  Calendar,
  Trophy,
  Flame,
  CheckCircle2,
  Circle,
  Clock,
  Lock,
  Unlock,
  MapPin,
  ExternalLink,
  Mic,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAdminUserDetail,
  useSetLocationLock,
  useRequestAudioSample,
  type SyncedGoal,
  type SyncedNiyat,
  type UserLocation,
  type UserMicStatus,
} from "@/lib/hooks/use-admin-api";

export const Route = createFileRoute("/admin/users/$userId")({
  component: UserDetailPage,
});

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function initials(first: string, last: string): string {
  const a = first?.[0] ?? "";
  const b = last?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

const SCOPE_LABEL: Record<SyncedGoal["scope"], string> = {
  yearly: "Yillik",
  monthly: "Oylik",
  weekly: "Haftalik",
  daily: "Kunlik",
};

const SCOPE_ORDER: SyncedGoal["scope"][] = ["yearly", "monthly", "weekly", "daily"];

function UserDetailPage() {
  const { userId } = Route.useParams();
  const { data, isLoading, isError, error } = useAdminUserDetail(userId);

  if (isLoading) {
    return <p className="text-[13px] text-tertiary">Yuklanyapti...</p>;
  }
  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-[13px] text-destructive">
        Xato: {error instanceof Error ? error.message : "Ma'lumot yo'q"}
      </div>
    );
  }

  const { user, stats, recentLogs, profileData, location, mic } = data;
  const syncedProfile = profileData?.profile?.value;
  const syncedNiyats = profileData?.niyats?.value ?? [];
  const syncedGoals = profileData?.goals?.value ?? [];
  const syncedStats = profileData?.stats?.value;

  // Photo: avval server'dagi sinxron snapshot, bo'lmasa null
  const photoUrl = syncedProfile?.photoDataUrl ?? null;

  // Niyatlar — aktiv (bajarilmagan) oldinda, keyin bajarilganlar
  const activeNiyats = syncedNiyats.filter((n) => n.completedAt === null);
  const doneNiyats = syncedNiyats.filter((n) => n.completedAt !== null);

  // Maqsadlar scope bo'yicha guruhlangan
  const goalsByScope: Record<SyncedGoal["scope"], SyncedGoal[]> = {
    yearly: [],
    monthly: [],
    weekly: [],
    daily: [],
  };
  for (const g of syncedGoals) {
    if (goalsByScope[g.scope]) goalsByScope[g.scope].push(g);
  }

  const todayIso = formatDate(Date.now());

  return (
    <div className="space-y-6">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1 text-[12px] text-tertiary hover:text-foreground transition"
      >
        <ArrowLeft size={14} /> Foydalanuvchilar
      </Link>

      {/* Profil hero — rasm + ism + telefon */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`${user.firstName} ${user.lastName}`}
                className="w-20 h-20 rounded-2xl object-cover border border-border"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-elevated border border-border flex items-center justify-center font-serif text-[24px] text-tertiary">
                {initials(user.firstName, user.lastName)}
              </div>
            )}
          </div>

          {/* Ma'lumot */}
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-[24px] text-foreground leading-tight">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-[13px] text-tertiary tabular mt-0.5">
              {user.phone}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-tertiary">
              <span>Ro'yxat: {formatDateTime(user.createdAt)}</span>
              <span>·</span>
              <span>Oxirgi aktiv: {formatDateTime(user.lastActiveAt)}</span>
            </div>
            {profileData && (
              <p className="text-[10px] text-tertiary mt-1">
                Profil sinxron:{" "}
                {profileData.profile
                  ? formatDateTime(profileData.profile.updatedAt)
                  : profileData.goals
                    ? formatDateTime(profileData.goals.updatedAt)
                    : "—"}
              </p>
            )}
          </div>

          {/* Premium status */}
          <div className="shrink-0">
            {user.isPremium ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-primary font-semibold">
                <Sparkles size={14} /> Doimiy Premium
              </span>
            ) : user.premiumExpiresAt && user.premiumExpiresAt > Date.now() ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-primary">
                <Sparkles size={14} /> Sovg'a ·{" "}
                {Math.ceil((user.premiumExpiresAt - Date.now()) / 86400000)} kun
              </span>
            ) : (
              <span className="text-[12px] text-tertiary">Bepul</span>
            )}
          </div>
        </div>

        {/* Yutuqlar (sinxron statistika) */}
        {syncedStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 pt-5 border-t border-border">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-tertiary">
                  Daraja
                </p>
                <p className="text-[14px] font-serif tabular text-foreground">
                  {syncedStats.level ?? 1}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Flame size={14} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-tertiary">
                  Joriy streak
                </p>
                <p className="text-[14px] font-serif tabular text-foreground">
                  {syncedStats.currentStreak ?? 0} kun
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-tertiary">
                  Eng uzun streak
                </p>
                <p className="text-[14px] font-serif tabular text-foreground">
                  {syncedStats.longestStreak ?? 0} kun
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-tertiary">
                  Bajarilgan
                </p>
                <p className="text-[14px] font-serif tabular text-foreground">
                  {syncedStats.totalTasksCompleted ?? 0}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ ADMIN CONTROLS ============ */}
      <LocationLockControl
        userId={user.id}
        locked={user.locationLocked ?? true}
      />

      {/* ============ JOYLASHUV XARITASI ============ */}
      <UserLocationMap location={location} />

      {/* ============ MIKROFON STATUSI ============ */}
      <MicStatusCard mic={mic} userId={user.id} />


      {/* Sinxron yo'q bo'lsa banner */}
      {!profileData?.profile && !profileData?.niyats && !profileData?.goals && (
        <div className="rounded-2xl border border-border bg-elevated/40 p-4 text-[12px] text-tertiary">
          Bu foydalanuvchi hali niyat va maqsadlarini server bilan sinxron
          qilmagan. Mobil ilova'da hisob ochilgan, lekin profil snapshot'i
          server'ga yetib kelmagan.
        </div>
      )}

      {/* ============ NIYATLAR ============ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-foreground inline-flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Niyatlar ({syncedNiyats.length})
          </h2>
          {profileData?.niyats && (
            <span className="text-[10px] text-tertiary">
              Sinxron: {formatDateTime(profileData.niyats.updatedAt)}
            </span>
          )}
        </div>

        {syncedNiyats.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-6 text-center">
            <p className="text-[13px] text-tertiary font-serif italic">
              Hozircha niyat yo'q
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeNiyats.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-tertiary mb-2">
                  Aktiv ({activeNiyats.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activeNiyats.map((n) => (
                    <NiyatCard key={n.id} niyat={n} />
                  ))}
                </div>
              </div>
            )}
            {doneNiyats.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-tertiary mb-2">
                  Bajarilgan ({doneNiyats.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {doneNiyats
                    .slice()
                    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
                    .map((n) => (
                      <NiyatCard key={n.id} niyat={n} />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ============ MAQSADLAR ============ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-foreground inline-flex items-center gap-2">
            <Target size={16} className="text-primary" />
            Maqsadlar ({syncedGoals.length})
          </h2>
          {profileData?.goals && (
            <span className="text-[10px] text-tertiary">
              Sinxron: {formatDateTime(profileData.goals.updatedAt)}
            </span>
          )}
        </div>

        {syncedGoals.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-6 text-center">
            <p className="text-[13px] text-tertiary font-serif italic">
              Hozircha maqsad yo'q
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {SCOPE_ORDER.map((scope) => {
              const list = goalsByScope[scope];
              if (list.length === 0) return null;
              return (
                <div key={scope}>
                  <p className="text-[10px] uppercase tracking-wider text-tertiary mb-2">
                    {SCOPE_LABEL[scope]} ({list.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {list.map((g) => (
                      <GoalCard key={g.id} goal={g} todayIso={todayIso} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ============ AI STATS ============ */}
      <section>
        <h2 className="text-[15px] font-semibold text-foreground mb-3 inline-flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          AI faollik
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Jami AI chaqiriqlar", value: stats.totalCalls, icon: Activity },
            { label: "Coach xabarlar", value: stats.coachCalls, icon: MessageCircle },
            { label: "TTS chaqiriqlar", value: stats.ttsCalls, icon: Volume2 },
            {
              label: "Jami xarajat",
              value: `$${stats.totalCost.toFixed(4)}`,
              icon: DollarSign,
            },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-tertiary">
                  {s.label}
                </p>
                <s.icon size={14} className="text-primary" />
              </div>
              <p className="text-[20px] font-serif tabular text-foreground">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ AI LOG ============ */}
      <section>
        <h2 className="text-[15px] font-semibold text-foreground mb-3">
          So'nggi 20 ta AI chaqiriq
        </h2>
        {recentLogs.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-8 text-center">
            <p className="text-[13px] text-tertiary font-serif italic">
              Hozircha AI chaqirig'i yo'q
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-elevated/50">
                <tr className="text-left text-[10px] uppercase tracking-wider text-tertiary">
                  <th className="px-4 py-2.5">Vaqt</th>
                  <th className="px-4 py-2.5">Endpoint</th>
                  <th className="px-4 py-2.5">Provayder</th>
                  <th className="px-4 py-2.5 hidden md:table-cell">Tokens</th>
                  <th className="px-4 py-2.5">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-elevated/30 transition">
                    <td className="px-4 py-2.5 text-[12px] text-tertiary tabular">
                      {formatDateTime(l.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-foreground">
                      {l.endpoint}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-foreground">
                      {l.provider}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-tertiary tabular hidden md:table-cell">
                      {l.inputTokens}↓ / {l.outputTokens}↑
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-primary tabular">
                      ${l.costUsd.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function LocationLockControl({
  userId,
  locked,
}: {
  userId: string;
  locked: boolean;
}) {
  const setLock = useSetLocationLock();
  const pending = setLock.isPending;

  const onToggle = () => {
    const next = !locked;
    setLock.mutate(
      { userId, locationLocked: next },
      {
        onSuccess: () => {
          toast.success(
            next
              ? "Joylashuv qulflandi — foydalanuvchi endi ochira olmaydi"
              : "Joylashuv qulfi ochildi — foydalanuvchi ozi boshqarishi mumkin",
          );
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Xato");
        },
      },
    );
  };

  return (
    <div
      className={`rounded-2xl border p-4 ${
        locked
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="shrink-0 mt-0.5">
            {locked ? (
              <Lock size={16} className="text-primary" />
            ) : (
              <Unlock size={16} className="text-tertiary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
              <MapPin size={12} className="text-primary" />
              Joylashuv qulfi
            </p>
            <p className="text-[11px] text-tertiary mt-1 leading-relaxed">
              {locked
                ? "Foydalanuvchi joylashuvni ozi ochira olmaydi. Juma kuni masjid eslatmasi va real namoz vaqtlari uchun majburiy."
                : "Foydalanuvchi joylashuvni xohlagan paytda ochirishi mumkin."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition disabled:opacity-50 ${
            locked
              ? "bg-card border border-border text-foreground hover:bg-elevated"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {pending ? "..." : locked ? "Qulfni ochish" : "Qulflash"}
        </button>
      </div>
    </div>
  );
}

// Admin brauzerida mikrofon test — shu kompyuter/telefon mic'idan 5 sek yozadi
// va eshittiradi. User qurilmasiga aloqasi yo'q — sof texnik QA.
function LocalMicTester() {
  const [state, setState] = useState<"idle" | "recording" | "ready">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Hozirgi audioUrl'ni ref'da tutamiz — unmount cleanup'da revoke qilish uchun
  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Komponent unmount bo'lganda mikrofon ham, blob URL ham tozalanadi
  useEffect(
    () => () => {
      cleanup();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    },
    [cleanup],
  );

  const startRecord = async () => {
    setError(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Live dB level meter (vizual signal)
      const AC = window.AudioContext || (window as unknown as {
        webkitAudioContext: typeof AudioContext;
      }).webkitAudioContext;
      const ac = new AC();
      const source = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        setLevel(Math.min(100, (sum / buf.length / 255) * 200));
        raf = requestAnimationFrame(tick);
      };
      tick();

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        cancelAnimationFrame(raf);
        void ac.close();
        cleanup();
        const blob = new Blob(chunks, { type: mimeType });
        setAudioUrl(URL.createObjectURL(blob));
        setLevel(0);
        setState("ready");
      };
      setState("recording");
      recorder.start();
      window.setTimeout(() => {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
      }, 5000);
    } catch (err) {
      cleanup();
      setError(
        err instanceof Error
          ? err.message
          : "Mikrofon ruxsati berilmadi yoki topilmadi",
      );
      setState("idle");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-tertiary">
            Mikrofon sifati testi
          </p>
          <p className="text-[10px] text-tertiary mt-0.5 leading-relaxed">
            Shu brauzer mikrofonidan 5 sek yozadi va eshittiradi
          </p>
        </div>
        <button
          type="button"
          onClick={startRecord}
          disabled={state === "recording"}
          className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-primary text-primary-foreground disabled:opacity-50"
        >
          {state === "recording"
            ? "Yozilmoqda..."
            : state === "ready"
              ? "Qaytadan"
              : "5s yozish"}
        </button>
      </div>

      {state === "recording" && (
        <div className="mt-2">
          <div className="h-2 rounded-full bg-elevated overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${level}%` }}
            />
          </div>
          <p className="text-[10px] text-tertiary mt-1 text-center">
            Gapiring — mikrofon darajasi
          </p>
        </div>
      )}

      {state === "ready" && audioUrl && (
        <audio controls src={audioUrl} className="w-full mt-2" />
      )}

      {error && (
        <p className="text-[11px] text-destructive mt-2">{error}</p>
      )}
    </div>
  );
}

function MicStatusCard({
  mic,
  userId,
}: {
  mic: UserMicStatus;
  userId: string;
}) {
  const { lastHeardAt, lastText, totalTranscripts } = mic;
  const requestAudio = useRequestAudioSample();

  const ageMinutes =
    lastHeardAt != null
      ? Math.round((Date.now() - lastHeardAt) / 60000)
      : null;
  // 5 daqiqa ichida — yashil "JONLI", 1 soat ichida sariq "yaqinda", aks holda kulrang
  const status: "live" | "recent" | "stale" | "never" =
    lastHeardAt == null
      ? "never"
      : ageMinutes != null && ageMinutes <= 5
        ? "live"
        : ageMinutes != null && ageMinutes <= 60
          ? "recent"
          : "stale";

  const statusColor =
    status === "live"
      ? "border-primary/40 bg-primary/5"
      : status === "recent"
        ? "border-border bg-card"
        : "border-border bg-card";

  const statusLabel =
    status === "live"
      ? "🟢 JONLI — hozir eshityapti"
      : status === "recent"
        ? "🟡 Yaqinda eshitgan"
        : status === "stale"
          ? "⚪ Uzoq vaqt jim"
          : "❌ Hech qachon eshitilmagan";

  const ageLabel =
    lastHeardAt == null
      ? "—"
      : ageMinutes == null
        ? "—"
        : ageMinutes < 1
          ? "hozirgina"
          : ageMinutes < 60
            ? `${ageMinutes} daq oldin`
            : ageMinutes < 1440
              ? `${Math.round(ageMinutes / 60)} soat oldin`
              : `${Math.round(ageMinutes / 1440)} kun oldin`;

  return (
    <div className={`rounded-2xl border p-4 ${statusColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
            <Mic size={12} className="text-primary" />
            Mikrofon statusi
          </p>
          <p className="text-[12px] mt-1.5 font-medium">{statusLabel}</p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-tertiary">
                Oxirgi eshitgan
              </p>
              <p className="text-[13px] tabular text-foreground mt-0.5">
                {ageLabel}
              </p>
              {lastHeardAt != null && (
                <p className="text-[10px] text-tertiary tabular">
                  {formatDateTime(lastHeardAt)}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-tertiary">
                Jami transkriptlar
              </p>
              <p className="text-[18px] font-serif tabular text-foreground mt-0.5">
                {totalTranscripts}
              </p>
            </div>
          </div>
          {lastText && (
            <div className="mt-3 rounded-lg bg-elevated/50 border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-tertiary mb-1">
                Oxirgi eshitilgan matn (test uchun)
              </p>
              <p className="text-[12px] text-foreground font-serif italic leading-snug">
                "{lastText}"
              </p>
            </div>
          )}
          {status === "never" && (
            <p className="text-[11px] text-tertiary mt-3 leading-relaxed">
              Foydalanuvchi hali APK'ni ochmagan yoki mikrofon ruxsatini
              bermagan. Ilova birinchi marta ochilganda heartbeat keladi.
            </p>
          )}

          {/* Mikrofon sifatini tekshirish — shu brauzer mikrofonida 5 sek yozadi */}
          <div className="mt-4 pt-4 border-t border-border">
            <LocalMicTester />
          </div>

          {/* User qurilmasidan kelgan sample (avval so'ralgan bo'lsa) */}
          {mic.sampleB64 && mic.sampleMime && (
            <div className="mt-3 rounded-lg bg-elevated/50 border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-tertiary mb-2">
                User qurilmasidan kelgan sample
                {mic.sampleAt && ` · ${formatDateTime(mic.sampleAt)}`}
              </p>
              <audio
                controls
                src={`data:${mic.sampleMime};base64,${mic.sampleB64}`}
                className="w-full"
              />
            </div>
          )}

          {/* So'rov tugmasi — agar user qurilmasidan audio kerak bo'lsa */}
          <button
            type="button"
            onClick={() => {
              requestAudio.mutate(userId, {
                onSuccess: () =>
                  toast.success(
                    "So'rov yuborildi — user ilovasi ochiq bo'lsa ~30 sek ichida keladi",
                  ),
                onError: (e) =>
                  toast.error(e instanceof Error ? e.message : "Xato"),
              });
            }}
            disabled={requestAudio.isPending || mic.requestPending}
            className="mt-3 w-full text-[11px] text-tertiary py-2 border border-border rounded-lg hover:bg-elevated transition disabled:opacity-50"
          >
            {mic.requestPending
              ? "User qurilmasidan kutilmoqda..."
              : "User qurilmasidan 5s audio so'rash (kerakmas bo'lsa bosmang)"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserLocationMap({ location }: { location: UserLocation | null }) {
  if (!location) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
          <MapPin size={12} className="text-tertiary" />
          Joriy joylashuv
        </p>
        <p className="text-[11px] text-tertiary mt-1.5 leading-relaxed">
          Foydalanuvchi hali joylashuvini server bilan baham kormagan. Ilova
          ochilganda va joylashuv yoqilgan bolsa avtomatik yangilanadi.
        </p>
      </div>
    );
  }

  const { latitude: lat, longitude: lon, accuracyM, updatedAt } = location;
  const d = 0.005; // ~500m radius
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
  const osmOpenUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
  const gmapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;

  const updatedLabel = updatedAt
    ? formatDateTime(updatedAt)
    : "noma'lum";
  const ageMinutes = updatedAt
    ? Math.round((Date.now() - updatedAt) / 60000)
    : null;
  const fresh = ageMinutes != null && ageMinutes < 60;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
            <MapPin size={12} className="text-primary" />
            Joriy joylashuv
            {fresh && (
              <span className="ml-1 text-[10px] text-primary font-normal">
                · jonli
              </span>
            )}
          </p>
          <p className="text-[11px] text-tertiary mt-1 tabular">
            {lat.toFixed(5)}, {lon.toFixed(5)}
            {accuracyM != null && ` · ±${Math.round(accuracyM)}m`}
          </p>
          <p className="text-[10px] text-tertiary mt-0.5">
            Yangilangan: {updatedLabel}
            {ageMinutes != null &&
              ` (${
                ageMinutes < 1
                  ? "hozir"
                  : ageMinutes < 60
                    ? `${ageMinutes} daq oldin`
                    : ageMinutes < 1440
                      ? `${Math.round(ageMinutes / 60)} soat oldin`
                      : `${Math.round(ageMinutes / 1440)} kun oldin`
              })`}
          </p>
        </div>
        <div className="shrink-0 flex flex-col gap-1.5">
          <a
            href={gmapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            Google Maps <ExternalLink size={10} />
          </a>
          <a
            href={osmOpenUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            OpenStreetMap <ExternalLink size={10} />
          </a>
        </div>
      </div>
      <iframe
        title="Foydalanuvchi joylashuvi"
        src={osmEmbedUrl}
        className="w-full h-72 border-t border-border block"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function NiyatCard({ niyat }: { niyat: SyncedNiyat }) {
  const done = niyat.completedAt !== null;
  return (
    <div
      className={`rounded-xl border p-3 ${
        done
          ? "bg-elevated/40 border-border"
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-start gap-2">
        {done ? (
          <CheckCircle2 size={14} className="text-primary shrink-0 mt-0.5" />
        ) : (
          <Circle size={14} className="text-tertiary shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`text-[13px] leading-snug ${
              done
                ? "text-tertiary line-through"
                : "text-foreground"
            }`}
          >
            {niyat.text}
          </p>
          <p className="text-[10px] text-tertiary mt-1 tabular">
            Yaratilgan: {formatDate(niyat.createdAt)}
            {done && niyat.completedAt
              ? ` · Bajarilgan: ${formatDate(niyat.completedAt)}`
              : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function GoalCard({ goal, todayIso }: { goal: SyncedGoal; todayIso: string }) {
  const doneToday = goal.completedDates.includes(todayIso);
  const totalDone = goal.completedDates.length;
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground leading-snug">
            {goal.title}
          </p>
          {goal.why && (
            <p className="text-[11px] text-tertiary mt-0.5 font-serif italic line-clamp-2">
              {goal.why}
            </p>
          )}
        </div>
        {doneToday && (
          <CheckCircle2 size={14} className="text-primary shrink-0 mt-0.5" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-tertiary tabular">
        {goal.timeOfDay && (
          <span className="inline-flex items-center gap-1">
            <Clock size={10} /> {goal.timeOfDay}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Calendar size={10} /> {totalDone} marta bajarilgan
        </span>
        <span>Yaratilgan: {formatDate(goal.createdAt)}</span>
      </div>
    </div>
  );
}
