import { useMemo, useState } from "react";
import { Play, Heart, Compass } from "lucide-react";
import { toast } from "sonner";
import {
  getDaysInCurrentMonth,
  getTodayQuranSurah,
  getTodayZamSurahs,
  memorization,
  prayers as fallbackPrayers,
  quranToday,
  todayHadith,
} from "@/lib/niyat-data";
import { usePrayerTimes } from "@/lib/hooks/use-prayer-times";
import { useLocalState } from "@/lib/use-local-state";
import { useAsmaProgress } from "@/lib/hooks/use-asma";
import { useSettings } from "@/lib/hooks/use-settings";
import { distanceToKaabaKm } from "@/lib/data/namoz-guide";
import { QuranPlayerSheet, MemorizationSheet, SadaqaSheet, AsmaSheet } from "../sheets";
import { KaabaSheet } from "../KaabaSheet";

type SadaqaEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
};

export function WorshipScreen() {
  const daysInMonth = getDaysInCurrentMonth();
  const { prayers: livePrayers, isLoading, isError } = usePrayerTimes();
  const prayers = livePrayers ?? fallbackPrayers;

  const [quranOpen, setQuranOpen] = useState(false);
  // MemorizationSheet endi `Barcha suralar`'dan tanlangan surani ham qabul qiladi
  const [memSurah, setMemSurah] = useState<{
    id: string;
    number?: number;
    arabic: string;
    latin: string;
  } | null>(null);
  const [sadaqaOpen, setSadaqaOpen] = useState(false);
  const [asmaOpen, setAsmaOpen] = useState(false);
  const [kaabaOpen, setKaabaOpen] = useState(false);
  const asma = useAsmaProgress();
  const { settings } = useSettings();
  const kaabaDistanceKm = settings.location
    ? distanceToKaabaKm(settings.location.latitude, settings.location.longitude)
    : null;

  const [sadaqaLog, setSadaqaLog] = useLocalState<SadaqaEntry[]>("niyat:sadaqa:log", []);
  const [sadaqaCount, setSadaqaCount] = useLocalState<number>("niyat:stats:sadaqaCount", 0);
  const [favorites, setFavorites] = useLocalState<string[]>("niyat:hadith:favorites", []);

  // Bugungi 3 ta zam sura — sana asosida har kuni avtomatik o'zgaradi
  const todayZamSurahs = useMemo(() => getTodayZamSurahs(), []);
  // Bugungi Qur'on suxsi — har kuni boshqa
  const todayQuranSurah = useMemo(() => getTodayQuranSurah(), []);

  const today = new Date();
  const todayDay = today.getDate();
  const sadaqaDoneDays = sadaqaLog
    .filter((e) => e.date.startsWith(today.toISOString().slice(0, 7)))
    .map((e) => Number(e.date.slice(-2)));
  const todaySadaqa = sadaqaLog.find(
    (e) => e.date === today.toISOString().slice(0, 10),
  );

  const isFavorite = favorites.includes(todayHadith.text);

  const addSadaqa = (desc: string) => {
    const date = today.toISOString().slice(0, 10);
    setSadaqaLog([
      ...sadaqaLog,
      { id: `s-${Date.now()}`, date, description: desc },
    ]);
    if (!sadaqaDoneDays.includes(todayDay)) {
      setSadaqaCount(sadaqaCount + 1);
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide pb-24">
      <div className="px-6 pt-4 pb-3">
        <h1 className="font-serif text-[26px] text-foreground">Ibodat</h1>
      </div>

      {/* Hero prayers */}
      <div className="mx-6 rounded-2xl bg-card border border-border p-5 geo-pattern fade-up">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
            Bugungi namozlar
          </p>
          {isLoading && <span className="text-[9px] text-tertiary tabular">yuklanyapti...</span>}
          {isError && <span className="text-[9px] text-destructive tabular">offline</span>}
        </div>
        <div className="mt-4 flex justify-between">
          {prayers.map((p) => {
            const filled = p.state === "done";
            const now = p.state === "now";
            return (
              <div key={p.id} className="flex flex-col items-center gap-2">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    filled
                      ? "bg-primary"
                      : now
                        ? "ring-2 ring-primary pulse-gold"
                        : "border border-border"
                  }`}
                  aria-label={
                    filled
                      ? `${p.name} o'qildi`
                      : now
                        ? `${p.name} — hozir vaqti`
                        : `${p.name} ${p.time} da`
                  }
                >
                  {filled && (
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path
                        d="M2 6.5L4.8 9L10 3"
                        stroke="#0E1410"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">{p.name}</span>
                <span className="text-[10px] tabular text-tertiary -mt-1">{p.time}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quran */}
      <section className="px-6 mt-6 fade-up">
        <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider">
          Qur'on
        </h2>
        <div className="mt-3 rounded-2xl bg-card border border-border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-tertiary uppercase tracking-wider">
                Bugungi tavsiya
              </p>
              <p className="mt-1 font-serif text-[20px] text-foreground">
                {todayQuranSurah.latin}
              </p>
              <p className="text-[11px] text-tertiary mt-0.5 tabular">
                {todayQuranSurah.number}-sura
              </p>
            </div>
            <p
              className="font-arabic text-quran text-[28px] text-primary shrink-0"
              dir="rtl"
            >
              {todayQuranSurah.arabic}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMemSurah(todayQuranSurah)}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold active:scale-95"
            >
              <Play size={14} fill="#0E1410" /> Boshlash
            </button>
            <button
              type="button"
              onClick={() => setQuranOpen(true)}
              className="h-10 px-4 rounded-xl border border-border bg-card text-foreground text-[13px] hover:border-primary/40 transition"
            >
              Barcha suralar
            </button>
          </div>
          <p
            className="mt-3 text-right text-[11px] tabular text-primary"
            aria-label={`${quranToday.streakDays} kunlik streak`}
          >
            🔥 {quranToday.streakDays} kun
          </p>
        </div>
      </section>

      {/* Memorization */}
      <section className="px-6 mt-6 fade-up">
        <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider">
          Yodlash
        </h2>
        <div className="mt-3 rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-foreground">{memorization.juz}</p>
            <p className="text-[11px] tabular text-muted-foreground">
              {memorization.done}/{memorization.total} sura
            </p>
          </div>
          <div
            className="mt-2 h-1.5 rounded-full bg-elevated"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={memorization.total}
            aria-valuenow={memorization.done}
          >
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${(memorization.done / memorization.total) * 100}%` }}
            />
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-wider text-tertiary">
            Bugungi takror
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {todayZamSurahs.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setMemSurah(s)}
                className="rounded-xl border border-border bg-elevated/40 py-3 text-center text-[12px] text-foreground active:scale-95 transition hover:border-primary/40"
              >
                <span className="font-arabic block text-quran text-[14px]">{s.arabic}</span>
                <span className="text-[10px] text-tertiary mt-1 block">{s.latin}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Ka'ba — qibla kompas va jonli efir */}
      <section className="px-6 mt-6 fade-up">
        <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider">
          Qibla
        </h2>
        <button
          type="button"
          onClick={() => setKaabaOpen(true)}
          aria-label="Ka'bani ko'rish va qibla"
          className="mt-3 w-full rounded-2xl p-5 text-left active:scale-[0.99] transition hover:border-primary/50 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(212,184,106,0.12), rgba(184,166,107,0.03))",
            border: "1px solid rgba(184,166,107,0.22)",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Compass size={22} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-foreground leading-tight">
                Ka'bani ko'rish
              </p>
              <p className="text-[11px] text-tertiary mt-1 leading-relaxed">
                {kaabaDistanceKm != null
                  ? `Jonli efir · Qibla kompas · ${kaabaDistanceKm.toLocaleString("uz-UZ", { maximumFractionDigits: 0 })} km`
                  : "Jonli efir · Qibla kompas"}
              </p>
            </div>
          </div>
        </button>
      </section>

      {/* Asma ul-Husna — 99 ism */}
      <section className="px-6 mt-6 fade-up">
        <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider">
          Allohning 99 ismi
        </h2>
        <button
          type="button"
          onClick={() => setAsmaOpen(true)}
          aria-label="Asma ul-Husnani ochish"
          className="mt-3 w-full rounded-2xl p-5 text-left active:scale-[0.99] transition hover:border-primary/40"
          style={{
            background:
              "linear-gradient(135deg, rgba(184,166,107,0.10), rgba(184,166,107,0.03))",
            border: "1px solid rgba(184,166,107,0.20)",
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-primary">Asma ul-Husna</p>
            <span className="text-[11px] tabular text-primary font-semibold">
              {asma.count}/{asma.total}
            </span>
          </div>
          <p
            className="mt-3 font-arabic text-quran text-[24px] leading-tight text-right"
            dir="rtl"
          >
            {asma.nextToMemorize?.arabic ?? "أَسْمَاءُ ٱللَّهِ ٱلْحُسْنَىٰ"}
          </p>
          {asma.nextToMemorize ? (
            <>
              <p className="mt-1 text-[14px] font-semibold text-foreground">
                {asma.nextToMemorize.number}. {asma.nextToMemorize.latin}
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {asma.nextToMemorize.meaning}
              </p>
            </>
          ) : (
            <p className="mt-1 text-[13px] text-primary font-semibold">
              🎉 Barchasi yodlandi! Mashallah.
            </p>
          )}
          <div className="mt-3 h-1.5 rounded-full bg-elevated overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(asma.count / asma.total) * 100}%` }}
            />
          </div>
        </button>
      </section>

      {/* Sadaqa */}
      <section className="px-6 mt-6 fade-up">
        <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wider">
          Sadaqa
        </h2>
        <div className="mt-3 rounded-2xl bg-card border border-border p-5">
          <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Bu oyning sadaqa kalendari">
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const has = sadaqaDoneDays.includes(day);
              const isToday = day === todayDay;
              return (
                <div
                  key={day}
                  role="gridcell"
                  aria-label={
                    has ? `${day}-kun: sadaqa qilindi` : isToday ? `${day}-kun: bugun` : `${day}-kun`
                  }
                  className={`aspect-square rounded-md flex items-center justify-center text-[9px] tabular ${
                    has
                      ? "bg-primary/80 text-primary-foreground"
                      : isToday
                        ? "border border-primary text-primary"
                        : "bg-elevated/50 text-tertiary"
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            {todaySadaqa ? `Bugun: "${todaySadaqa.description}"` : "Bugun sadaqa qilinmagan"}
          </p>
          <button
            type="button"
            onClick={() => setSadaqaOpen(true)}
            className="mt-2 text-[12px] text-primary hover:text-primary/80 transition"
          >
            + Sadaqa bayonotini qo'shish
          </button>
        </div>
      </section>

      {/* Hadith */}
      <section className="px-6 mt-6 mb-2 fade-up">
        <div
          className="rounded-2xl p-5 relative"
          style={{
            background:
              "linear-gradient(135deg, rgba(212,184,106,0.10), rgba(184,166,107,0.04))",
            border: "1px solid rgba(184,166,107,0.18)",
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] tracking-[0.2em] uppercase text-primary">Hadis-darmon</p>
            <button
              type="button"
              aria-label={isFavorite ? "Sevimlilardan o'chirish" : "Sevimlilarga qo'shish"}
              onClick={() => {
                if (isFavorite) {
                  setFavorites(favorites.filter((f) => f !== todayHadith.text));
                  toast.info("Sevimlilardan o'chirildi");
                } else {
                  setFavorites([...favorites, todayHadith.text]);
                  toast.success("Sevimlilarga qo'shildi");
                }
              }}
              className={`transition ${
                isFavorite ? "text-primary" : "text-primary/70 hover:text-primary"
              }`}
            >
              <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
          <p className="mt-3 font-serif italic text-[15px] leading-relaxed text-foreground">
            “{todayHadith.text}”
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">{todayHadith.source}</p>
        </div>
      </section>

      <QuranPlayerSheet
        open={quranOpen}
        onClose={() => setQuranOpen(false)}
        onSelectSurah={(s) => {
          setQuranOpen(false);
          setMemSurah(s);
        }}
      />
      <MemorizationSheet
        open={!!memSurah}
        onClose={() => setMemSurah(null)}
        surah={memSurah}
      />
      <SadaqaSheet open={sadaqaOpen} onClose={() => setSadaqaOpen(false)} onAdd={addSadaqa} />
      <AsmaSheet open={asmaOpen} onClose={() => setAsmaOpen(false)} />
      <KaabaSheet open={kaabaOpen} onClose={() => setKaabaOpen(false)} />
    </div>
  );
}
