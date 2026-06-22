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

function timeAgo(at: number): string {
  const sec = Math.floor((Date.now() - at) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}d`;
  const h = Math.floor(min / 60);
  return `${h}s`;
}
