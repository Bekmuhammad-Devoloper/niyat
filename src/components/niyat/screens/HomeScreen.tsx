import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { TrendingDown, TrendingUp, Minus, Flame, Mic, Plus, Pencil, MoonStar, Check, X, MicOff, Target, BookOpen, ChevronRight } from "lucide-react";
import {
  nextPrayerHero,
  profile,
  type NiyatItem,
} from "@/lib/niyat-data";
import { formatCountdown, usePrayerTimes } from "@/lib/hooks/use-prayer-times";
import { formatGregorianUz } from "@/lib/api/aladhan";
import { useUserProfile } from "@/lib/hooks/use-user-profile";
import { useStats } from "@/lib/hooks/use-stats";
import { useSpeechRecognition } from "@/lib/hooks/use-speech";
import { useSunnat } from "@/lib/hooks/use-sunnat";
import { useNiyats } from "@/lib/hooks/use-niyats";
import { useAppTime } from "@/lib/hooks/use-app-time";
import {
  useGoals,
  shouldShowToday,
  sortByTimeOfDay,
  isCompletedToday,
} from "@/lib/hooks/use-goals";
import { autoCapitalize, capitalizeFirst } from "@/lib/text-utils";
import { Flag } from "../Flag";
import { SunnatSheet, ScreenTimeSheet } from "../sheets";
import { AnnouncementBanner } from "../AnnouncementBanner";

function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(Math.round(from + (target - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return v;
}

function Checkbox({
  done,
  onToggle,
  label,
}: {
  done: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`${label} — ${done ? "bajarildi" : "bajarilmagan"}`}
      onClick={onToggle}
      className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
        done ? "bg-primary border-primary" : "border-tertiary hover:border-primary/60"
      }`}
    >
      {done && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2 6.5L4.8 9L10 3"
            stroke="#0E1410"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

export function HomeScreen({
  onOpenVoice,
}: { onOpenVoice?: () => void } = {}) {
  // "Bugungi reja" endi Maqsadlar (useGoals)dan kelib chiqadi.
  // Kunlik scope + bugunga to'g'ri keladigan haftalik/oylik maqsadlar.
  const { goals, toggleToday, add: addGoal } = useGoals();
  const [addingTask, setAddingTask] = useState(false);
  const [draftTaskTitle, setDraftTaskTitle] = useState("");
  const [draftTaskTime, setDraftTaskTime] = useState("");
  const todayGoals = useMemo(
    () => goals.filter((g) => shouldShowToday(g)).sort(sortByTimeOfDay),
    [goals],
  );
  const niyats = useNiyats();
  // editingId: null = ko'rish rejimi; "new" = yangi qo'shish; "<id>" = tahrirlash
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [sunnatOpen, setSunnatOpen] = useState(false);
  const [screenTimeOpen, setScreenTimeOpen] = useState(false);
  // voiceOpen state ataylab bu yerda yo'q — NiyatApp'da boshqariladi.
  // Sabab: BackgroundMic'ni pauza qilish uchun voiceModeOpen ham shu yerda
  // bo'lishi kerak (NiyatApp), aks holda FAB bossangiz mic conflict bo'ladi.
  const sunnat = useSunnat();
  const appTime = useAppTime();
  const { nextPrayer, hijriReadable, gregorianReadable } = usePrayerTimes();
  const todayUz = gregorianReadable ?? formatGregorianUz(new Date());
  const { profile: user } = useUserProfile();
  const stats = useStats();

  const stt = useSpeechRecognition({
    lang: "uz-UZ",
    onResult: (text, isFinal) => {
      if (isFinal) {
        setDraftText((prev) => autoCapitalize(prev ? `${prev} ${text}` : text));
      }
    },
  });

  const startAdding = () => {
    setEditingId("new");
    setDraftText("");
  };
  const startEditing = (item: NiyatItem) => {
    setEditingId(item.id);
    setDraftText(item.text);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraftText("");
    if (stt.isListening) stt.stop();
  };
  const saveNiyat = () => {
    const cleaned = capitalizeFirst(draftText.trim());
    if (!cleaned) return cancelEdit();
    if (editingId === "new") {
      niyats.add(cleaned);
      toast.success("Yangi niyat qo'shildi");
    } else if (editingId) {
      niyats.update(editingId, cleaned);
      toast.success("Niyat yangilandi");
    }
    cancelEdit();
  };

  const doneTasksCount = todayGoals.filter((g) => isCompletedToday(g)).length;
  const streak = useCountUp(stats.currentStreak);
  const doneAnim = useCountUp(doneTasksCount);

  const toggleGoalDone = (id: string) => {
    toggleToday(id);
    stats.markTaskDone();
  };

  const saveQuickTask = () => {
    const title = capitalizeFirst(draftTaskTitle.trim());
    if (!title) return;
    const cleanTime = draftTaskTime.trim();
    const time = /^\d{2}:\d{2}$/.test(cleanTime) ? cleanTime : undefined;
    addGoal({
      title,
      why: "Bugungi reja",
      scope: "daily",
      cadence: { kind: "daily" },
      timeOfDay: time,
    });
    setDraftTaskTitle("");
    setDraftTaskTime("");
    setAddingTask(false);
    toast.success("Bugungi rejaga qo'shildi");
  };

  const cancelQuickTask = () => {
    setDraftTaskTitle("");
    setDraftTaskTime("");
    setAddingTask(false);
  };

  const heroPrayer = nextPrayer
    ? {
        name: nextPrayer.name,
        time: nextPrayer.time,
        countdown: formatCountdown(nextPrayer.time),
      }
    : nextPrayerHero;

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto scrollbar-hide pb-28">
        <div className="px-6 pt-4 pb-3 fade-up">
          <h1 className="font-serif text-[28px] leading-tight text-foreground">
            Assalomu alaykum, {user.firstName}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground tabular">
            {hijriReadable ?? profile.hijriDate} · {todayUz}
          </p>
        </div>

        {/* Admin e'lon banner — agar yangi e'lon bo'lsa */}
        <AnnouncementBanner />

        {/* Next prayer */}
        <div className="mx-6 mt-2 rounded-2xl bg-card border border-border relative overflow-hidden fade-up">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
          <div className="flex items-center justify-between p-5 pl-6">
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                Keyingi namoz
              </p>
              <p className="mt-2 text-[32px] font-serif leading-none text-foreground">
                {heroPrayer.name}
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground tabular">
                <span className="text-foreground">{heroPrayer.time}</span> · {heroPrayer.countdown}
              </p>
            </div>
            <MoonStar className="text-primary/60" size={36} strokeWidth={1.2} aria-hidden />
          </div>
        </div>

        {/* Bugungi niyatim — eski dizayn, 30s carousel bilan */}
        <NiyatCarousel
          niyats={niyats}
          editingId={editingId}
          draftText={draftText}
          setDraftText={setDraftText}
          startEditing={startEditing}
          startAdding={startAdding}
          cancelEdit={cancelEdit}
          saveNiyat={saveNiyat}
          stt={stt}
        />

        {/* Bugungi sunnat */}
        <button
          type="button"
          onClick={() => setSunnatOpen(true)}
          aria-label="Bugungi sunnatni ochish"
          className="mx-6 mt-4 w-[calc(100%-3rem)] rounded-2xl bg-card border border-border p-4 text-left active:scale-[0.99] transition fade-up hover:border-primary/40"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(184,166,107,0.12)",
                  border: "1px solid rgba(184,166,107,0.25)",
                }}
              >
                <BookOpen size={16} className="text-primary" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-tertiary">
                  Bugungi sunnat
                </p>
                <p className="mt-0.5 text-[14px] text-foreground font-semibold truncate">
                  {sunnat.isLoading
                    ? "Yuklanyapti..."
                    : (sunnat.today?.title ?? "Niyatga ko'ra amal")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {sunnat.appliedToday && (
                <span
                  aria-label="Bugun bajarildi"
                  className="h-5 w-5 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check size={12} className="text-primary-foreground" strokeWidth={3} />
                </span>
              )}
              <ChevronRight size={14} className="text-tertiary" />
            </div>
          </div>
        </button>

        {/* Stats */}
        <div className="mx-6 mt-4 grid grid-cols-3 gap-2 fade-up">
          <button
            type="button"
            onClick={() => setScreenTimeOpen(true)}
            aria-label="Ekran vaqtini kiritish"
            className="rounded-2xl bg-card border border-border p-3 text-left hover:border-primary/30 active:scale-[0.98] transition"
          >
            <p className="text-[10px] uppercase tracking-wider text-tertiary">
              Ekran vaqti
            </p>
            <p className="mt-2 text-[16px] font-semibold text-foreground tabular leading-none">
              {appTime.formatted}
            </p>
            <div className="mt-2 text-[11px] tabular">
              {appTime.trendPct === null ? (
                <span className="text-tertiary inline-flex items-center gap-1">
                  <Pencil size={11} strokeWidth={2.2} aria-hidden />
                  {appTime.isManual ? "qo'lda" : "kiritish"}
                </span>
              ) : appTime.trendDir === "down" ? (
                <span className="text-[#4A7C59] inline-flex items-center gap-1">
                  <TrendingDown size={14} strokeWidth={2.2} aria-hidden />
                  {appTime.trendPct}%
                </span>
              ) : appTime.trendDir === "up" ? (
                <span className="text-destructive inline-flex items-center gap-1">
                  <TrendingUp size={14} strokeWidth={2.2} aria-hidden />
                  {appTime.trendPct}%
                </span>
              ) : (
                <span className="text-tertiary inline-flex items-center gap-1">
                  <Minus size={14} strokeWidth={2.2} aria-hidden />
                  0%
                </span>
              )}
            </div>
          </button>
          <StatTile
            label="Vazifalar"
            value={`${doneAnim}/${todayGoals.length}`}
            sub={
              <span className="text-primary inline-flex items-center gap-1">
                <Target size={14} strokeWidth={2.2} aria-hidden />
                {todayGoals.length > 0
                  ? Math.round((doneAnim / todayGoals.length) * 100)
                  : 0}
                %
              </span>
            }
          />
          <StatTile
            label="Streak"
            value={`${streak} kun`}
            sub={
              <span className="text-primary inline-flex items-center gap-1">
                <Flame size={14} strokeWidth={2.2} fill="currentColor" aria-hidden />
                faol
              </span>
            }
          />
        </div>

        {/* Bugungi reja — Maqsadlar Kunlik bilan bir xil ma'lumot */}
        <div className="px-6 mt-6 fade-up">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-foreground">Bugungi reja</h2>
            <span className="text-[11px] text-tertiary tabular">
              {doneTasksCount}/{todayGoals.length}
            </span>
          </div>
          <ul className="mt-3 space-y-1">
            {todayGoals.length === 0 && !addingTask && (
              <li>
                <p className="text-[13px] text-tertiary text-center py-6 font-serif italic">
                  Bugun rejada hech narsa yo'q
                </p>
              </li>
            )}
            {todayGoals.map((g) => {
              const done = isCompletedToday(g);
              return (
                <li
                  key={g.id}
                  className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-card/60 transition"
                >
                  <span className="text-[11px] tabular text-tertiary mt-1 w-10 shrink-0">
                    {g.timeOfDay ?? ""}
                  </span>
                  <Checkbox
                    done={done}
                    onToggle={() => toggleGoalDone(g.id)}
                    label={g.title}
                  />
                  <span
                    className={`flex-1 text-[14px] leading-snug ${
                      done ? "text-tertiary line-through" : "text-foreground"
                    }`}
                  >
                    {g.title}
                  </span>
                  {g.scope !== "daily" && (
                    <span className="mt-1 text-[10px] uppercase tracking-wider text-tertiary shrink-0">
                      {g.scope === "weekly"
                        ? "haftalik"
                        : g.scope === "monthly"
                          ? "oylik"
                          : g.scope}
                    </span>
                  )}
                </li>
              );
            })}

            {/* Quick-add form yoki tugma */}
            {addingTask ? (
              <li
                className="rounded-xl border border-primary/40 bg-card p-3 mt-2 fade-up"
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelQuickTask();
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={draftTaskTime}
                    onChange={(e) => setDraftTaskTime(e.target.value)}
                    aria-label="Vaqt"
                    className="w-[90px] bg-elevated border border-border rounded-md px-2 py-1.5 text-[12px] tabular text-foreground outline-none focus:border-primary/60"
                  />
                  <input
                    type="text"
                    value={draftTaskTitle}
                    onChange={(e) => setDraftTaskTitle(autoCapitalize(e.target.value))}
                    autoFocus
                    maxLength={80}
                    placeholder="Reja matni..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveQuickTask();
                    }}
                    autoCapitalize="sentences"
                    className="flex-1 bg-elevated border border-border rounded-md px-3 py-1.5 text-[13px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60"
                  />
                </div>
                <div className="mt-2 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={cancelQuickTask}
                    aria-label="Bekor qilish"
                    className="p-1.5 text-tertiary hover:text-foreground transition"
                  >
                    <X size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={saveQuickTask}
                    disabled={!draftTaskTitle.trim()}
                    aria-label="Saqlash"
                    className="p-1.5 text-primary hover:text-primary/80 disabled:opacity-40 transition"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </li>
            ) : (
              <li>
                <button
                  type="button"
                  onClick={() => setAddingTask(true)}
                  className="mt-1 flex items-center gap-2 px-3 py-2 text-[13px] text-tertiary hover:text-primary transition"
                  aria-label="Bugungi rejaga qo'shish"
                >
                  <Plus size={14} /> Reja qo'shish
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Niyat bilan gaplashish — ovozli muloqot rejimini ochish.
          MVP 2'ning asosiy entry-point'i. NiyatApp uni ochadi va shu
          paytda BackgroundMic'ni avtomatik pauza qiladi (mic conflict
          oldini olish uchun). */}
      <button
        type="button"
        onClick={() => onOpenVoice?.()}
        className="absolute bottom-4 right-5 h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/40 flex items-center justify-center active:scale-95 transition z-30 pulse-gold"
        aria-label="Niyat bilan ovozli gaplashish"
      >
        <Mic size={26} strokeWidth={2.4} />
      </button>

      <SunnatSheet open={sunnatOpen} onClose={() => setSunnatOpen(false)} />
      <ScreenTimeSheet open={screenTimeOpen} onClose={() => setScreenTimeOpen(false)} />
    </div>
  );
}

// Niyat carousel — eski dizayn, har 30 soniyada keyingisiga avtomatik o'tadi.
function NiyatCarousel({
  niyats,
  editingId,
  draftText,
  setDraftText,
  startEditing,
  startAdding,
  cancelEdit,
  saveNiyat,
  stt,
}: {
  niyats: ReturnType<typeof useNiyats>;
  editingId: string | null;
  draftText: string;
  setDraftText: (s: string) => void;
  startEditing: (item: NiyatItem) => void;
  startAdding: () => void;
  cancelEdit: () => void;
  saveNiyat: () => void;
  stt: ReturnType<typeof useSpeechRecognition>;
}) {
  const items = niyats.items;
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  // Indeksni har doim chegarada saqlash
  useEffect(() => {
    if (items.length > 0 && idx >= items.length) setIdx(0);
  }, [items.length, idx]);

  // Auto-rotate har 30 soniyada — tahrirlash paytida pauza
  useEffect(() => {
    if (editingId !== null) return;
    if (items.length <= 1) return;
    const id = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setIdx((i) => (i + 1) % items.length);
        setFading(false);
      }, 220);
    }, 30000);
    return () => window.clearInterval(id);
  }, [items.length, editingId]);

  const current = items[idx] ?? null;

  // Yangi qo'shish rejimi — alohida ko'rinish
  if (editingId === "new") {
    return (
      <div
        className="mx-6 mt-4 rounded-2xl p-5 fade-up"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,166,107,0.10), rgba(184,166,107,0.03))",
          border: "1px solid rgba(184,166,107,0.30)",
        }}
      >
        <p className="font-serif italic text-[13px] text-primary mb-3">Yangi niyat</p>
        <NiyatEditor
          value={draftText}
          onChange={setDraftText}
          onCancel={cancelEdit}
          onSave={saveNiyat}
          stt={stt}
        />
      </div>
    );
  }

  // Bo'sh holat
  if (items.length === 0) {
    return (
      <div
        className="mx-6 mt-4 rounded-2xl p-5 fade-up"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,166,107,0.10), rgba(184,166,107,0.03))",
          border: "1px solid rgba(184,166,107,0.18)",
        }}
      >
        <p className="font-serif italic text-[13px] text-primary">Bugungi niyatim</p>
        <p className="mt-3 font-serif text-[14px] text-tertiary italic">
          Hali niyat yo'q. Bugun nima qilmoqchisiz?
        </p>
        <button
          type="button"
          onClick={startAdding}
          className="mt-3 inline-flex items-center gap-1 text-[12px] text-primary hover:text-primary/80 transition"
        >
          <Plus size={12} /> Niyat qo'shish
        </button>
      </div>
    );
  }

  // Joriy niyatni tahrirlash
  if (current && editingId === current.id) {
    return (
      <div
        className="mx-6 mt-4 rounded-2xl p-5 fade-up"
        style={{
          background:
            "linear-gradient(135deg, rgba(184,166,107,0.10), rgba(184,166,107,0.03))",
          border: "1px solid rgba(184,166,107,0.30)",
        }}
      >
        <p className="font-serif italic text-[13px] text-primary mb-3">Niyatni tahrirlash</p>
        <NiyatEditor
          value={draftText}
          onChange={setDraftText}
          onCancel={cancelEdit}
          onSave={saveNiyat}
          stt={stt}
        />
      </div>
    );
  }

  if (!current) return null;
  const isDone = current.completedAt !== null;

  return (
    <div
      className="mx-6 mt-4 rounded-2xl p-5 fade-up"
      style={{
        background:
          "linear-gradient(135deg, rgba(184,166,107,0.10), rgba(184,166,107,0.03))",
        border: "1px solid rgba(184,166,107,0.18)",
      }}
    >
      <div className="flex items-center justify-between">
        <p className="font-serif italic text-[13px] text-primary">Bugungi niyatim</p>
        <button
          type="button"
          onClick={startAdding}
          aria-label="Yangi niyat qo'shish"
          className="inline-flex items-center gap-1 text-[11px] text-tertiary hover:text-primary transition"
        >
          <Plus size={12} /> Yangi
        </button>
      </div>

      {/* Matn — fade animatsiya bilan */}
      <p
        className={`mt-3 font-serif text-[16px] leading-relaxed transition-opacity duration-200 ${
          fading ? "opacity-0" : "opacity-100"
        } ${isDone ? "text-tertiary line-through" : "text-foreground"}`}
      >
        “{current.text}”
      </p>

      {/* Pastki qator: dots (chap), action tugmalari (o'ng) */}
      <div className="mt-4 flex items-center justify-between gap-3">
        {items.length > 1 ? (
          <div className="flex items-center gap-1.5" aria-label="Niyatlar pozitsiyasi">
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  setFading(true);
                  setTimeout(() => {
                    setIdx(i);
                    setFading(false);
                  }, 120);
                }}
                aria-label={`${i + 1}-niyatga o'tish`}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx
                    ? "w-5 bg-primary"
                    : it.completedAt !== null
                      ? "w-1.5 bg-tertiary/40"
                      : "w-1.5 bg-tertiary/70 hover:bg-primary/60"
                }`}
              />
            ))}
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              isDone
                ? niyats.markUndone(current.id)
                : niyats.markDone(current.id)
            }
            aria-label={isDone ? "Qaytarib qo'yish" : "Bajardim"}
            className={`inline-flex items-center gap-1 text-[11px] transition ${
              isDone
                ? "text-tertiary hover:text-foreground"
                : "text-primary hover:text-primary/80"
            }`}
          >
            <Check size={12} strokeWidth={2.2} />
            <span className="leading-none">{isDone ? "Qaytarish" : "Bajardim"}</span>
          </button>
          <button
            type="button"
            onClick={() => startEditing(current)}
            aria-label="Niyatni tahrirlash"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition"
          >
            <Pencil size={12} strokeWidth={2.2} />
            <span className="leading-none">Tahrirlash</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Niyat tahrirlash/qo'shish uchun ichki forma — mic, save/cancel bilan.
function NiyatEditor({
  value,
  onChange,
  onSave,
  onCancel,
  stt,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  stt: ReturnType<typeof useSpeechRecognition>;
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(autoCapitalize(e.target.value))}
        maxLength={240}
        autoFocus
        autoCapitalize="sentences"
        aria-label="Niyat"
        placeholder={stt.isListening ? "Tinglayapman..." : "Niyatingizni yozing..."}
        className="w-full bg-background/40 border border-primary/20 rounded-lg p-3 text-[15px] font-serif text-foreground leading-relaxed outline-none focus:border-primary/60 transition resize-none"
        rows={3}
      />
      <div className="mt-2 flex items-center justify-between">
        {stt.supported ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (stt.isListening ? stt.stop() : stt.start())}
              aria-label={stt.isListening ? "Mikrofonni to'xtatish" : "Ovozli kiritish"}
              className={`p-1.5 rounded-lg transition ${
                stt.isListening
                  ? "bg-destructive/20 text-destructive pulse-gold"
                  : "text-tertiary hover:text-primary"
              }`}
            >
              {stt.isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            {stt.isListening && (
              <Flag code={stt.activeLang.slice(0, 2)} size={14} />
            )}
            {stt.error && (
              <span className="text-[10px] text-destructive truncate max-w-[160px]">
                {stt.error}
              </span>
            )}
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Bekor qilish"
            className="p-1.5 text-tertiary hover:text-foreground transition"
          >
            <X size={14} />
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!value.trim()}
            aria-label="Saqlash"
            className="p-1.5 text-primary hover:text-primary/80 disabled:opacity-40 transition"
          >
            <Check size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-tertiary">{label}</p>
      <p className="mt-2 text-[16px] font-semibold text-foreground tabular leading-none">
        {value}
      </p>
      <div className="mt-2 text-[11px] tabular">{sub}</div>
    </div>
  );
}

