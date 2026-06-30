// Mikrofon debug ekrani — orqa fonda eshitilayotgan transkriptlarni
// ko'rsatadi. "Niyat" deyish ishlamasa, foydalanuvchi shu yerni ochib
// mikrofon umuman eshityaptimi va qanday yozib olayotganini ko'radi.
//
// Faqat APK'da haqiqiy ma'lumot beradi. Web'da bo'sh ko'rinadi.

import { useCallback, useEffect, useState } from "react";
import { Mic, RefreshCw, Trash2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import {
  getBackgroundTranscripts,
  clearBackgroundTranscripts,
  isBackgroundMicRunning,
  ensureMicPermission,
  openMicPermissionSettings,
  stopBackgroundMicAndWait,
  type Transcript,
} from "@/lib/hooks/use-background-mic";
import { Capacitor } from "@capacitor/core";

const REFRESH_INTERVAL = 2000;

export function MicDebugSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [running, setRunning] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  const refresh = useCallback(async () => {
    if (!isNative) {
      setTranscripts([]);
      setRunning(false);
      return;
    }
    setRefreshing(true);
    try {
      const [t, r] = await Promise.all([
        getBackgroundTranscripts(),
        isBackgroundMicRunning(),
      ]);
      // Eng yangisi tepada
      setTranscripts([...t].reverse().slice(0, 50));
      setRunning(r);
    } catch (err) {
      console.warn("[mic-debug] refresh failed", err);
    } finally {
      setRefreshing(false);
    }
  }, [isNative]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const id = window.setInterval(refresh, REFRESH_INTERVAL);
    return () => window.clearInterval(id);
  }, [open, refresh]);

  const clearAll = async () => {
    if (!isNative) return;
    await clearBackgroundTranscripts();
    void refresh();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Mikrofon — debug">
      <div className="space-y-3">
        {/* Holat */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic
                size={16}
                className={running ? "text-emerald-400" : "text-tertiary"}
              />
              <p className="text-[13px] font-semibold text-foreground">
                {running === null
                  ? "Tekshirilmoqda..."
                  : running
                    ? "Mikrofon eshityapti"
                    : "Mikrofon o'chiq"}
              </p>
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="h-8 w-8 rounded-lg bg-elevated/60 flex items-center justify-center active:scale-95 transition"
              aria-label="Yangilash"
            >
              <RefreshCw
                size={13}
                className={`text-foreground ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          {/* Mikrofon ruxsati holati */}
          <MicPermissionStatus />
          {!isNative && (
            <p className="mt-2 text-[11px] text-tertiary leading-relaxed">
              Bu sahifa faqat APK telefon ilovasida ma'lumot beradi. Web
              brauzerda orqa fon mikrofoni mavjud emas.
            </p>
          )}
          {isNative && running === false && (
            <p className="mt-2 text-[11px] text-amber-400/90 leading-relaxed">
              Mikrofon o'chiq. Sozlamalar → Ovoz va til → "'Niyat' desam
              ochilsin" yoqilgan ekanini va mikrofon ruxsati berilganini
              tekshiring.
            </p>
          )}
        </div>

        {/* Mic test diagnostic — getUserMedia haqiqatda nima qaytaradi */}
        <MicTestDiagnostic />

        {/* Transkriptlar */}
        <div className="rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <p className="text-[11px] uppercase tracking-wider text-tertiary">
              Oxirgi {transcripts.length} ta transkript
            </p>
            {transcripts.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] text-destructive hover:text-destructive/80 inline-flex items-center gap-1"
              >
                <Trash2 size={11} /> Tozalash
              </button>
            )}
          </div>
          <div className="max-h-[50vh] overflow-y-auto scrollbar-hide">
            {transcripts.length === 0 ? (
              <p className="p-5 text-center text-[12px] text-tertiary leading-relaxed">
                Hali transkript yo'q. Yaqinroqda gapiring va 2-3 sekund kuting.
                Eshitganda shu yerda ko'rinadi.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {transcripts.map((t, i) => {
                  const hasWake = /niyat|niyyat|neyat|nyat|ниат|нийат|ниять/i.test(
                    t.text,
                  );
                  return (
                    <li key={i} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-[13px] leading-snug ${
                            hasWake ? "text-emerald-400 font-semibold" : "text-foreground"
                          }`}
                        >
                          {hasWake && "🔔 "}
                          {t.text}
                        </p>
                        <span className="text-[10px] text-tertiary tabular shrink-0">
                          {timeAgo(t.at)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <p className="text-[10px] text-tertiary text-center leading-relaxed px-2">
          🔔 belgili transkriptda "Niyat" so'zi topildi (yashil rangda).
          Topilmasa — STT siz aytgan so'zni boshqacha yozayapti yoki mikrofon
          eshitmayapti. Yaqinroqda, balandroq gapiring.
        </p>
      </div>
    </BottomSheet>
  );
}

// Mikrofon ruxsati holati — Permissions API orqali tekshiriladi va
// foydalanuvchiga aniq holatni ko'rsatadi. APK'da WebView ham app-level
// mic permission'ga ulanadi, shu sabab "denied" bo'lsa Android Settings'dan
// qo'lda berish kerak.
function MicPermissionStatus() {
  const [status, setStatus] = useState<"granted" | "denied" | "prompt" | "unknown">(
    "unknown",
  );

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const perms = (navigator as Navigator & {
          permissions?: {
            query: (q: { name: string }) => Promise<{ state: string }>;
          };
        }).permissions;
        if (!perms?.query) {
          if (!cancelled) setStatus("unknown");
          return;
        }
        const res = await perms.query({ name: "microphone" });
        if (!cancelled) setStatus(res.state as typeof status);
      } catch {
        if (!cancelled) setStatus("unknown");
      }
    };
    void check();
    const id = window.setInterval(check, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
  };

  if (status === "unknown") return null;
  const color =
    status === "granted"
      ? "text-emerald-400"
      : status === "denied"
        ? "text-destructive"
        : "text-amber-400";
  const label =
    status === "granted"
      ? "✓ Mikrofon ruxsati berilgan"
      : status === "denied"
        ? "✗ Mikrofon ruxsati rad etilgan — Android Settings'dan qayta bering"
        : "? Mikrofon ruxsati hali so'ralmagan";

  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <p className={`text-[11px] ${color}`}>{label}</p>
      {status === "prompt" && (
        <button
          type="button"
          onClick={requestPermission}
          className="text-[10px] text-primary underline"
        >
          So'rash
        </button>
      )}
    </div>
  );
}

// Mic test — getUserMedia haqiqatda nima qaytaradi (aniq xato turi)
function MicTestDiagnostic() {
  const [status, setStatus] = useState<{
    ok: boolean;
    label: string;
    detail: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      // 1) Avval BackgroundMic'ni to'liq to'xtatamiz
      await stopBackgroundMicAndWait();
      // 2) Capacitor permission system'ni majburiy chaqirib OS dialog'ni chiqaramiz
      const perm = await ensureMicPermission();
      if (!perm.granted) {
        setStatus({
          ok: false,
          label: `Ruxsat: ${perm.state}`,
          detail:
            "OS RECORD_AUDIO berilmadi. Sozlamalar tugmasini bosib qo'lda yoqing.",
        });
        return;
      }
      // 3) getUserMedia'ni sinab ko'ramiz
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tracks = stream.getAudioTracks();
      const trackInfo = tracks
        .map((t) => `${t.label || "?"} (${t.readyState})`)
        .join(", ");
      stream.getTracks().forEach((t) => t.stop());
      setStatus({
        ok: true,
        label: "✓ Mikrofon ishlaydi",
        detail: `Audio track: ${trackInfo}`,
      });
    } catch (err) {
      const e = err as Error & { name?: string };
      const name = e?.name ?? "Error";
      const msg = e?.message ?? String(err);
      let advice = "";
      if (name === "NotAllowedError") {
        advice =
          "OS RECORD_AUDIO ruxsati yo'q. Sozlamalar → Niyat → Ruxsatlar → Mikrofon → Allow.";
      } else if (name === "NotReadableError") {
        advice =
          "Mikrofon BAND. Boshqa ilovani yoping (Telegram qo'ng'iroq, Google Assistant, ovoz yozuvchi).";
      } else if (name === "NotFoundError") {
        advice = "Mikrofon topilmadi (qurilma muammosi).";
      } else if (name === "OverconstrainedError") {
        advice = "Audio constraints muammosi. Brauzer audio formatlarini cheklamoqda.";
      } else {
        advice = "Noma'lum xato. Ilovani qayta boshlang yoki APK'ni qayta o'rnating.";
      }
      setStatus({
        ok: false,
        label: `${name}`,
        detail: `${msg}\n\n${advice}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-foreground">
          Mikrofon sinash (diagnostic)
        </p>
        <button
          type="button"
          onClick={runTest}
          disabled={testing}
          className="px-3 h-8 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium active:scale-95 transition disabled:opacity-50"
        >
          {testing ? "Sinanmoqda..." : "Sinab ko'rish"}
        </button>
      </div>
      {status && (
        <div
          className={`rounded-lg p-3 text-[11px] leading-relaxed ${
            status.ok
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "bg-destructive/10 text-destructive border border-destructive/30"
          }`}
        >
          <p className="font-semibold mb-1">{status.label}</p>
          <p className="whitespace-pre-line">{status.detail}</p>
          {!status.ok && (
            <button
              type="button"
              onClick={() => void openMicPermissionSettings()}
              className="mt-2 inline-flex items-center gap-1 text-[11px] underline"
            >
              Telefon sozlamalarini ochish →
            </button>
          )}
        </div>
      )}
      <p className="text-[10px] text-tertiary leading-relaxed">
        Bu tugma 1) BackgroundMic'ni to'xtatadi, 2) RECORD_AUDIO ruxsatini
        so'raydi, 3) getUserMedia'ni sinaydi va aniq xato turini ko'rsatadi.
        Voice mode ishlamasa shu yerda nima muammo ekanligini bilasiz.
      </p>
    </div>
  );
}

function timeAgo(at: number): string {
  const sec = Math.floor((Date.now() - at) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}d`;
  const h = Math.floor(min / 60);
  return `${h}s`;
}
