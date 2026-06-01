import { Pause, Play, X } from "lucide-react";
import { useQuranPlayer } from "@/lib/audio/quran-player";

// TabBar tepasida ko'rinadigan kichik audio panel.
// Faqat sura ijro etilayotgan (yoki pauza qilingan) paytda chiqadi.
// Foydalanuvchi istalgan ekrandan tilovati to'xtatishi mumkin.
export function AudioMiniPlayer() {
  const { isPlaying, surah, currentTime, duration, pause, resume, stop } =
    useQuranPlayer();

  if (!surah) return null;

  const isAdhan = surah.kind === "adhan";
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (sec: number): string => {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative border-t border-border bg-card/95 backdrop-blur-sm">
      {/* Progress bar — eng yuqorisida nozik chiziq */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-elevated">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="px-4 py-2.5 flex items-center gap-3">
        {/* Sura / Azon ma'lumoti */}
        <div className="min-w-0 flex-1">
          <p className={`text-[12.5px] font-semibold truncate ${
            isAdhan ? "text-primary" : "text-foreground"
          }`}>
            {isAdhan ? `🕌 ${surah.latin}` : surah.latin}
          </p>
          <p className="text-[10px] text-tertiary tabular truncate">
            {isAdhan
              ? "Loop — to'xtatmaguningizcha davom etadi"
              : `${surah.reciterName} · ${formatTime(currentTime)}${
                  duration > 0 ? ` / ${formatTime(duration)}` : ""
                }`}
          </p>
        </div>

        {/* Play/Pause */}
        <button
          type="button"
          onClick={() => (isPlaying ? pause() : resume())}
          aria-label={isPlaying ? "To'xtatish" : "Davom etish"}
          className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
        </button>

        {/* Stop (yopish) */}
        <button
          type="button"
          onClick={() => stop()}
          aria-label="Tilovat'ni yopish"
          className="h-9 w-9 rounded-lg border border-border bg-card text-tertiary hover:text-destructive hover:border-destructive/40 flex items-center justify-center transition"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
