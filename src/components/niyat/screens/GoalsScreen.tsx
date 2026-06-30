import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Mic, MicOff, Check, Trash2, Clock, Pencil, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { type Goal, type GoalCadence } from "@/lib/niyat-data";
import {
  useGoals,
  isToday,
  isCompletedToday,
  describeCadence,
  shouldShowToday,
  shouldShowThisWeek,
  sortByTimeOfDay,
  periodProgress,
  periodTarget,
  periodCompleted,
  periodLabel,
  eligibleParentScopes,
  SCOPE_LABEL,
} from "@/lib/hooks/use-goals";
import { useSpeechRecognition } from "@/lib/hooks/use-speech";
import { autoCapitalize } from "@/lib/text-utils";
import { Flag } from "../Flag";
import { useConfirmDialog } from "../useConfirmDialog";

const tabs = [
  { key: "yearly", label: "Yillik" },
  { key: "monthly", label: "Oylik" },
  { key: "weekly", label: "Haftalik" },
  { key: "daily", label: "Kunlik" },
] as const satisfies ReadonlyArray<{ key: Goal["scope"]; label: string }>;

type TabKey = (typeof tabs)[number]["key"];

// Hafta kunlari — Dushanbadan boshlanadi (O'zbek tartibi)
const WEEKDAYS_SHORT = ["Du", "Se", "Cho", "Pa", "Ju", "Sha", "Yak"];
// getDay() qaytaradigan raqamga moslash (0=Yak, 1=Du, ...)
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

type CadenceKind =
  | "daily" // har kuni
  | "count" // haftada N marta
  | "specific" // hafta aniq kunlari (Du, Cho, Ju ...)
  | "monthly_count" // oyda N marta
  | "monthly_specific"; // oyning aniq sanalari (1, 15 ...)

export function GoalsScreen() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [active, setActive] = useState<TabKey>("weekly");
  const { goals, add, update, remove, toggleToday, getChildrenOf, getParentOf } = useGoals();
  // editingId: null = forma yopiq; "new" = yangi qo'shish; "<id>" = tahrirlash
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftWhy, setDraftWhy] = useState("");
  // Haftalik/kunlik uchun cadence
  const [cadenceKind, setCadenceKind] = useState<CadenceKind>("daily");
  const [targetPerWeek, setTargetPerWeek] = useState(3);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]); // Du, Cho, Ju
  // Monthly cadence uchun
  const [targetPerMonth, setTargetPerMonth] = useState(1);
  const [selectedDaysOfMonth, setSelectedDaysOfMonth] = useState<number[]>([1]); // 1-chi sana
  const [timeOfDay, setTimeOfDay] = useState<string>(""); // HH:MM (majburiy)
  const [parentId, setParentId] = useState<string>(""); // bo'sh = mustaqil maqsad
  const [micTarget, setMicTarget] = useState<"title" | "why" | null>(null);
  // Qaysi parent maqsadning children'lari ko'rinib turibdi
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Tahrirlash uchun forma'ni maqsadning joriy qiymatlari bilan to'ldirish
  const startEditing = (g: Goal) => {
    setEditingId(g.id);
    setDraftTitle(g.title);
    setDraftWhy(g.why);
    if (g.cadence?.kind === "daily") {
      setCadenceKind("daily");
    } else if (g.cadence?.kind === "count") {
      setCadenceKind("count");
      setTargetPerWeek(g.cadence.targetPerWeek);
    } else if (g.cadence?.kind === "specific") {
      setCadenceKind("specific");
      setSelectedDays(g.cadence.days);
    } else if (g.cadence?.kind === "monthly_count") {
      setCadenceKind("monthly_count");
      setTargetPerMonth(g.cadence.targetPerMonth);
    } else if (g.cadence?.kind === "monthly_specific") {
      setCadenceKind("monthly_specific");
      setSelectedDaysOfMonth(g.cadence.daysOfMonth);
    }
    setTimeOfDay(g.timeOfDay ?? "");
    setParentId(g.parentId ?? "");
    // Forma scope ham tahrir qilingan maqsadning scope'iga moslashtiriladi
    setActive(g.scope);
  };

  const stt = useSpeechRecognition({
    lang: "uz-UZ",
    onResult: (text, isFinal) => {
      if (!isFinal) return;
      if (micTarget === "title") {
        setDraftTitle((prev) =>
          autoCapitalize((prev ? `${prev} ${text}` : text).slice(0, 80)),
        );
      } else if (micTarget === "why") {
        setDraftWhy((prev) =>
          autoCapitalize((prev ? `${prev} ${text}` : text).slice(0, 160)),
        );
      }
    },
  });

  const toggleMic = (target: "title" | "why") => {
    if (!stt.supported) {
      toast.info("Brauzer ovozli kiritishni qo'llamaydi");
      return;
    }
    if (stt.isListening && micTarget === target) {
      stt.stop();
      setMicTarget(null);
      return;
    }
    if (stt.isListening) stt.stop();
    setMicTarget(target);
    setTimeout(() => stt.start(), 50);
  };

  const filteredGoals = useMemo(() => {
    // "Kunlik" tab — bugungi kun uchun barcha tegishli maqsadlar:
    // daily, haftalik (bugun mos kelsa), oylik (bugun mos kelsa)
    if (active === "daily") {
      return goals.filter((g) => shouldShowToday(g)).sort(sortByTimeOfDay);
    }
    // "Haftalik" tab — haftalik + oylik (shu hafta mos kelsa)
    if (active === "weekly") {
      return goals.filter((g) => shouldShowThisWeek(g)).sort(sortByTimeOfDay);
    }
    // Oylik va yillik — faqat o'z scope'i
    return goals.filter((g) => g.scope === active).sort(sortByTimeOfDay);
  }, [goals, active]);

  const resetForm = () => {
    setDraftTitle("");
    setDraftWhy("");
    setCadenceKind("daily");
    setTargetPerWeek(3);
    setSelectedDays([1, 3, 5]);
    setTargetPerMonth(1);
    setSelectedDaysOfMonth([1]);
    setTimeOfDay("");
    setParentId("");
    setEditingId(null);
  };

  // Yangi maqsad uchun mumkin bo'lgan parent'lar — scope kattaroq bo'lganlar
  const parentCandidates = useMemo(() => {
    const eligibleScopes = new Set(eligibleParentScopes(active));
    return goals.filter((g) => eligibleScopes.has(g.scope));
  }, [goals, active]);

  // Maqsadni yangi qism qilib qo'shish — parent'ni avval tanlab, scope avtomatik
  const startAddingChild = (parent: Goal, childScope: TabKey) => {
    resetForm();
    setActive(childScope);
    setParentId(parent.id);
    setEditingId("new");
    // Cadence default'lari shu scope uchun mantiqli
    setCadenceKind("daily");
  };

  const toggleExpand = (goalId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  const handleSave = () => {
    const cap = (s: string) =>
      s ? s.charAt(0).toLocaleUpperCase("uz") + s.slice(1) : s;
    const title = cap(draftTitle.trim());
    const why = cap(draftWhy.trim());
    if (!title || !why) return;

    // Cadence o'rnatish:
    // - daily scope:   doim "daily" cadence (kun davomida)
    // - weekly scope:  daily / count / specific
    // - monthly scope: daily / count / monthly_count / monthly_specific
    // - yearly:        cadence yo'q
    let cadence: GoalCadence | undefined;
    if (active === "daily") {
      cadence = { kind: "daily" };
    } else if (active === "weekly") {
      if (cadenceKind === "daily") {
        cadence = { kind: "daily" };
      } else if (cadenceKind === "count") {
        cadence = { kind: "count", targetPerWeek: Math.max(1, targetPerWeek) };
      } else if (cadenceKind === "specific") {
        if (selectedDays.length === 0) {
          toast.error("Kamida bitta kun tanlang");
          return;
        }
        cadence = { kind: "specific", days: [...selectedDays].sort() };
      }
    } else if (active === "monthly") {
      if (cadenceKind === "daily") {
        cadence = { kind: "daily" };
      } else if (cadenceKind === "count") {
        cadence = { kind: "count", targetPerWeek: Math.max(1, targetPerWeek) };
      } else if (cadenceKind === "specific") {
        if (selectedDays.length === 0) {
          toast.error("Kamida bitta hafta kuni tanlang");
          return;
        }
        cadence = { kind: "specific", days: [...selectedDays].sort() };
      } else if (cadenceKind === "monthly_count") {
        cadence = { kind: "monthly_count", targetPerMonth: Math.max(1, targetPerMonth) };
      } else if (cadenceKind === "monthly_specific") {
        if (selectedDaysOfMonth.length === 0) {
          toast.error("Kamida bitta sana tanlang");
          return;
        }
        cadence = { kind: "monthly_specific", daysOfMonth: [...selectedDaysOfMonth].sort((a, b) => a - b) };
      }
    }

    // Cadence bo'lsa — vaqt majburiy
    const cleanTime = timeOfDay.trim();
    if (cadence && !/^\d{2}:\d{2}$/.test(cleanTime)) {
      toast.error("Soatni belgilang");
      return;
    }
    const time = /^\d{2}:\d{2}$/.test(cleanTime) ? cleanTime : undefined;

    const parent = parentId.trim() ? parentId : undefined;
    if (editingId && editingId !== "new") {
      // Tahrirlash — mavjud maqsadni yangilash
      update(editingId, {
        title,
        why,
        scope: active,
        cadence,
        timeOfDay: time,
        parentId: parent,
      });
      toast.success("Maqsad yangilandi");
    } else {
      // Yangi qo'shish
      add({ title, why, scope: active, cadence, timeOfDay: time, parentId: parent });
      toast.success("Yangi maqsad qo'shildi");
    }
    resetForm();
  };

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto scrollbar-hide pb-28">
        <div className="px-6 pt-4 pb-2">
          <h1 className="font-serif text-[26px] text-foreground">Maqsadlar</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Niyat — amalning ruhi</p>
        </div>

        {/* Segmented */}
        <div
          role="tablist"
          aria-label="Maqsadlar muddati"
          className="mx-6 mt-3 grid grid-cols-4 rounded-xl bg-card border border-border p-1"
        >
          {tabs.map((t) => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(t.key)}
                className={`py-2 text-[12px] rounded-lg transition ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Yangi maqsad yoki tahrirlash formasi */}
        {editingId !== null && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="mx-6 mt-4 rounded-2xl bg-card border border-primary/40 p-5 fade-up"
          >
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-foreground">
                {editingId === "new" ? "Yangi maqsad" : "Maqsadni tahrirlash"}
              </p>
              <button
                type="button"
                aria-label="Yopish"
                onClick={resetForm}
                className="text-tertiary hover:text-foreground transition"
              >
                <X size={16} />
              </button>
            </div>

            <label className="block mt-3">
              <span className="sr-only">Maqsad nomi</span>
              <div className="relative">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(autoCapitalize(e.target.value))}
                  maxLength={80}
                  placeholder={
                    stt.isListening && micTarget === "title"
                      ? "Tinglayapman..."
                      : "Maqsad nomi..."
                  }
                  className="w-full bg-background/40 border border-border rounded-lg px-3 py-2.5 pr-11 text-[14px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 transition"
                  autoFocus
                  autoCapitalize="sentences"
                />
                <button
                  type="button"
                  onClick={() => toggleMic("title")}
                  aria-label={
                    stt.isListening && micTarget === "title"
                      ? "Mikrofonni to'xtatish"
                      : "Ovozli kiritish"
                  }
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md flex items-center justify-center transition ${
                    stt.isListening && micTarget === "title"
                      ? "bg-destructive/20 text-destructive pulse-gold"
                      : "text-tertiary hover:text-primary"
                  }`}
                >
                  {stt.isListening && micTarget === "title" ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              </div>
            </label>

            <label className="block mt-2">
              <span className="sr-only">Nima uchun?</span>
              <div className="relative">
                <textarea
                  value={draftWhy}
                  onChange={(e) => setDraftWhy(autoCapitalize(e.target.value))}
                  maxLength={160}
                  placeholder={
                    stt.isListening && micTarget === "why"
                      ? "Tinglayapman..."
                      : "Nima uchun? (Bu maqsadning niyati...)"
                  }
                  rows={2}
                  autoCapitalize="sentences"
                  className="w-full bg-background/40 border border-border rounded-lg px-3 py-2.5 pr-11 text-[13px] font-serif italic text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 transition resize-none"
                />
                <button
                  type="button"
                  onClick={() => toggleMic("why")}
                  aria-label={
                    stt.isListening && micTarget === "why"
                      ? "Mikrofonni to'xtatish"
                      : "Ovozli kiritish"
                  }
                  className={`absolute right-1.5 top-2 h-8 w-8 rounded-md flex items-center justify-center transition ${
                    stt.isListening && micTarget === "why"
                      ? "bg-destructive/20 text-destructive pulse-gold"
                      : "text-tertiary hover:text-primary"
                  }`}
                >
                  {stt.isListening && micTarget === "why" ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              </div>
            </label>

            {/* Cadence picker — haftalik va oylik uchun (kunlik doim "har kuni") */}
            {(active === "weekly" || active === "monthly") && (
              <CadencePicker
                scope={active}
                kind={cadenceKind}
                onKindChange={setCadenceKind}
                targetPerWeek={targetPerWeek}
                onTargetChange={setTargetPerWeek}
                selectedDays={selectedDays}
                onDaysChange={setSelectedDays}
                targetPerMonth={targetPerMonth}
                onTargetMonthChange={setTargetPerMonth}
                selectedDaysOfMonth={selectedDaysOfMonth}
                onDaysOfMonthChange={setSelectedDaysOfMonth}
              />
            )}

            {/* Vaqt — cadence bo'lgan barcha maqsadlar uchun majburiy */}
            {(active === "weekly" || active === "daily" || active === "monthly") && (
              <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
                <label
                  htmlFor="goal-time"
                  className="text-[11px] uppercase tracking-wider text-tertiary inline-flex items-center gap-1.5"
                >
                  <Clock size={12} className="text-primary" />
                  Soati
                  <span className="text-destructive">*</span>
                </label>
                <input
                  id="goal-time"
                  type="time"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  required
                  className="mt-2 w-full bg-elevated border border-border rounded-md px-3 py-2 text-[14px] tabular text-foreground outline-none focus:border-primary/60"
                />
                <p className="mt-1.5 text-[10px] text-tertiary">
                  Kunlik ko'rinishda vaqt bo'yicha tartiblanadi
                </p>
              </div>
            )}

            {/* Parent selector — yillik bo'lmagan barcha maqsadlar uchun ixtiyoriy */}
            {active !== "yearly" && parentCandidates.length > 0 && (
              <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
                <label
                  htmlFor="goal-parent"
                  className="text-[11px] uppercase tracking-wider text-tertiary inline-flex items-center gap-1.5"
                >
                  <Link2 size={12} className="text-primary" />
                  Katta maqsadning qismi (ixtiyoriy)
                </label>
                <select
                  id="goal-parent"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="mt-2 w-full bg-elevated border border-border rounded-md px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary/60"
                >
                  <option value="">— Mustaqil maqsad —</option>
                  {parentCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{SCOPE_LABEL[p.scope]}] {p.title}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[10px] text-tertiary">
                  Yillik → oylik → haftalik → kunlik tartibida bo'linadi
                </p>
              </div>
            )}

            {stt.error && (
              <p className="mt-2 text-[11px] text-destructive">{stt.error}</p>
            )}
            {stt.isListening && (
              <p className="mt-2 text-[11px] text-primary inline-flex items-center gap-1">
                <Flag code={stt.activeLang.slice(0, 2)} size={14} /> gapiring...
              </p>
            )}
            <button
              type="submit"
              disabled={!draftTitle.trim() || !draftWhy.trim()}
              className="mt-3 w-full h-10 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold disabled:opacity-40 active:scale-[0.98] transition"
            >
              {editingId === "new" ? "Saqlash" : "Yangilash"}
            </button>
          </form>
        )}

        <div className="px-6 mt-5 space-y-3">
          {filteredGoals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center fade-up">
              <p className="text-[13px] text-muted-foreground">
                Bu davrda hali maqsad yo'q.
              </p>
              <p className="text-[12px] text-tertiary mt-1 font-serif italic">
                Niyat qil — bir qadam qo'y.
              </p>
            </div>
          ) : (
            filteredGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                parent={getParentOf(g)}
                children={getChildrenOf(g.id)}
                expanded={expandedParents.has(g.id)}
                onToggleExpand={() => toggleExpand(g.id)}
                onAddChild={() => {
                  // Bir scope kichikroq turdagi bola yaratish
                  // yearly → monthly, monthly → weekly, weekly → daily
                  const childScope: TabKey | null =
                    g.scope === "yearly"
                      ? "monthly"
                      : g.scope === "monthly"
                        ? "weekly"
                        : g.scope === "weekly"
                          ? "daily"
                          : null;
                  if (childScope) startAddingChild(g, childScope);
                }}
                // Kunlik/Haftalik tab'da boshqa scope'dagi maqsadlarni alohida belgilab qo'yamiz
                showOriginScope={
                  (active === "daily" && g.scope !== "daily") ||
                  (active === "weekly" && g.scope !== "weekly")
                }
                onToggleToday={() => toggleToday(g.id)}
                onEdit={() => startEditing(g)}
                onRemove={async () => {
                  const childCount = getChildrenOf(g.id).length;
                  const msg = childCount
                    ? `"${g.title}" maqsadini o'chiramizmi?\n\n${childCount} ta kichik maqsad mustaqil qoladi.`
                    : `"${g.title}" maqsadini o'chirmoqchimisiz?`;
                  const ok = await confirm({
                    title: "Maqsadni o'chirish",
                    message: msg,
                    confirmLabel: "O'chirish",
                    cancelLabel: "Bekor qilish",
                    danger: true,
                  });
                  if (ok) {
                    remove(g.id);
                    toast.info("Maqsad o'chirildi");
                  }
                }}
              />
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => (editingId === null ? setEditingId("new") : resetForm())}
        aria-label={editingId === null ? "Yangi maqsad qo'shish" : "Yopish"}
        aria-expanded={editingId !== null}
        className="absolute bottom-4 right-5 inline-flex items-center gap-2 h-12 px-5 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/40 active:scale-95 transition z-30"
      >
        <Plus size={18} /> <span className="text-[13px] font-semibold">Yangi maqsad</span>
      </button>
      {confirmDialog}
    </div>
  );
}

// ============================================================
// Cadence picker — yangi maqsad yaratish formasi ichida
// ============================================================
function CadencePicker({
  scope,
  kind,
  onKindChange,
  targetPerWeek,
  onTargetChange,
  selectedDays,
  onDaysChange,
  targetPerMonth,
  onTargetMonthChange,
  selectedDaysOfMonth,
  onDaysOfMonthChange,
}: {
  scope: "weekly" | "monthly";
  kind: CadenceKind;
  onKindChange: (k: CadenceKind) => void;
  targetPerWeek: number;
  onTargetChange: (n: number) => void;
  selectedDays: number[];
  onDaysChange: (d: number[]) => void;
  targetPerMonth: number;
  onTargetMonthChange: (n: number) => void;
  selectedDaysOfMonth: number[];
  onDaysOfMonthChange: (d: number[]) => void;
}) {
  const toggleDay = (val: number) => {
    onDaysChange(
      selectedDays.includes(val)
        ? selectedDays.filter((d) => d !== val)
        : [...selectedDays, val],
    );
  };

  const toggleDayOfMonth = (val: number) => {
    onDaysOfMonthChange(
      selectedDaysOfMonth.includes(val)
        ? selectedDaysOfMonth.filter((d) => d !== val)
        : [...selectedDaysOfMonth, val],
    );
  };

  // Scope'ga qarab variantlar
  // Haftalik: 3 ta (daily, haftada N, hafta kunlari)
  // Oylik: 5 ta (har kuni, haftada N, hafta kunlari, oyda N, oyning aniq sanasi)
  const options =
    scope === "weekly"
      ? [
          { key: "daily" as const, label: "Har kuni" },
          { key: "count" as const, label: "Haftada N marta" },
          { key: "specific" as const, label: "Hafta kunlari" },
        ]
      : [
          { key: "daily" as const, label: "Har kuni" },
          { key: "count" as const, label: "Haftada N marta" },
          { key: "specific" as const, label: "Hafta kunlari" },
          { key: "monthly_count" as const, label: "Oyda N marta" },
          { key: "monthly_specific" as const, label: "Oyning aniq sanasi" },
        ];

  return (
    <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-wider text-tertiary mb-2">
        Qachon bajariladi
      </p>
      <div
        className={`grid gap-1.5 ${
          scope === "monthly" ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        {options.map((opt) => {
          const isActive = kind === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onKindChange(opt.key)}
              className={`px-2 py-1.5 rounded-md text-[11px] transition ${
                isActive
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-elevated text-tertiary hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {kind === "count" && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12px] text-tertiary">Haftada</span>
          <input
            type="number"
            min={1}
            max={7}
            value={targetPerWeek}
            onChange={(e) =>
              onTargetChange(Math.max(1, Math.min(7, Number(e.target.value) || 1)))
            }
            className="w-14 bg-elevated border border-border rounded-md px-2 py-1 text-[13px] tabular text-center text-foreground outline-none focus:border-primary/60"
          />
          <span className="text-[12px] text-tertiary">marta</span>
        </div>
      )}

      {kind === "specific" && (
        <div className="mt-3">
          <p className="text-[11px] text-tertiary mb-2">Qaysi kunlarda?</p>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS_SHORT.map((label, i) => {
              const val = WEEKDAY_VALUES[i];
              const isActive = selectedDays.includes(val);
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => toggleDay(val)}
                  aria-pressed={isActive}
                  className={`py-2 rounded-md text-[11px] transition ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-elevated text-tertiary hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {kind === "monthly_count" && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12px] text-tertiary">Oyda</span>
          <input
            type="number"
            min={1}
            max={31}
            value={targetPerMonth}
            onChange={(e) =>
              onTargetMonthChange(
                Math.max(1, Math.min(31, Number(e.target.value) || 1)),
              )
            }
            className="w-14 bg-elevated border border-border rounded-md px-2 py-1 text-[13px] tabular text-center text-foreground outline-none focus:border-primary/60"
          />
          <span className="text-[12px] text-tertiary">marta</span>
        </div>
      )}

      {kind === "monthly_specific" && (
        <div className="mt-3">
          <p className="text-[11px] text-tertiary mb-2">
            Oyning qaysi sanalarida? ({selectedDaysOfMonth.length} ta tanlangan)
          </p>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((val) => {
              const isActive = selectedDaysOfMonth.includes(val);
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => toggleDayOfMonth(val)}
                  aria-pressed={isActive}
                  className={`py-1.5 rounded-md text-[11px] tabular transition ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-elevated text-tertiary hover:text-foreground"
                  }`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Goal card — bitta maqsadning kartochkasi (progress + Bajardim + delete)
// ============================================================
function GoalCard({
  goal,
  parent,
  children,
  expanded,
  showOriginScope = false,
  onToggleExpand,
  onAddChild,
  onToggleToday,
  onEdit,
  onRemove,
}: {
  goal: Goal;
  parent: Goal | null;
  children: Goal[];
  expanded: boolean;
  showOriginScope?: boolean;
  onToggleExpand: () => void;
  onAddChild: () => void;
  onToggleToday: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  // Cadence asoslangan progress — scope'ga qarab haftalik yoki oylik
  const hasCadence = goal.cadence !== undefined;
  const done = hasCadence ? periodCompleted(goal) : 0;
  const target = hasCadence ? periodTarget(goal) : 0;
  const progress = hasCadence
    ? periodProgress(goal)
    : (goal.progress ?? 0); // eski yillik maqsadlar uchun qo'lda progress
  const doneToday = isCompletedToday(goal);
  const fitsToday = isToday(goal.cadence);
  const cadenceLabel = describeCadence(goal.cadence);
  const periodName = periodLabel(goal.scope);

  // Iyerarxiya: bola scope qaysi bo'lishi mumkin (parentdan kichikroq)
  const childScopeLabel =
    goal.scope === "yearly"
      ? "Oylik bo'lim"
      : goal.scope === "monthly"
        ? "Haftalik bo'lim"
        : goal.scope === "weekly"
          ? "Kunlik bo'lim"
          : null;

  return (
    <article className="rounded-2xl bg-card border border-border p-5 fade-up">
      {/* Parent breadcrumb — agar ushbu maqsad katta maqsadning qismi bo'lsa */}
      {parent && (
        <div className="mb-2 inline-flex items-center gap-1 text-[10px] text-tertiary uppercase tracking-wider">
          <Link2 size={10} className="text-primary" />
          Qismi: <span className="text-foreground normal-case">{parent.title}</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Vaqt va manba scope — sarlavhadan tepada kichik metabar */}
          {(goal.timeOfDay || showOriginScope) && (
            <div className="flex items-center gap-2 mb-1.5 text-[10px] tabular">
              {goal.timeOfDay && (
                <span className="inline-flex items-center gap-1 text-primary font-semibold">
                  <Clock size={11} />
                  {goal.timeOfDay}
                </span>
              )}
              {showOriginScope && (
                <span className="uppercase tracking-wider text-tertiary">
                  · {goal.scope === "weekly" ? "Haftalik" : goal.scope}
                </span>
              )}
            </div>
          )}
          <h3 className="text-[15.5px] font-semibold text-foreground leading-snug">
            {goal.title}
          </h3>
        </div>
        {cadenceLabel ? (
          <span className="shrink-0 text-[10px] tabular text-primary border border-primary/30 bg-primary/5 rounded-md px-2 py-1">
            {cadenceLabel}
          </span>
        ) : goal.days ? (
          <span className="shrink-0 text-[10px] tabular text-tertiary border border-border rounded-md px-2 py-1">
            {goal.days}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 font-serif italic text-[12.5px] text-muted-foreground">
        {goal.why}
      </p>

      <div
        className="mt-4 h-1.5 rounded-full bg-elevated overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={`${goal.title} progressi`}
      >
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-tertiary tabular">
        {hasCadence
          ? `${periodName}: ${done}/${target} bajardim`
          : (goal.sub ?? `${Math.round(progress * 100)}% bajarildi`)}
      </p>

      {/* Haftalik tarmoq — qaysi kun bajarilgani ko'rinadi */}
      {hasCadence && <WeekStrip goal={goal} />}

      {/* Bajardim tugmasi — faqat haftalik/kunlik uchun va bugun rejada bo'lsa */}
      <div className="mt-3 flex items-center gap-2">
        {hasCadence && fitsToday && (
          <button
            type="button"
            onClick={onToggleToday}
            className={`flex-1 h-9 rounded-lg text-[12.5px] font-semibold inline-flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
              doneToday
                ? "bg-primary/15 text-primary border border-primary/40"
                : "bg-primary text-primary-foreground"
            }`}
          >
            <Check size={14} />
            {doneToday ? "Bugun bajarildi" : "Bugun bajardim"}
          </button>
        )}
        {hasCadence && !fitsToday && (
          <p className="flex-1 text-center text-[11px] text-tertiary py-2">
            Bugun bu maqsad rejada yo'q
          </p>
        )}
        {/* Cadence yo'q (oylik/yillik) — Bajardim tugmasi o'rniga bo'sh joy */}
        {!hasCadence && <span className="flex-1" />}
        <button
          type="button"
          onClick={onEdit}
          aria-label="Maqsadni tahrirlash"
          className="h-9 w-9 rounded-lg border border-border bg-card text-tertiary hover:text-primary hover:border-primary/40 inline-flex items-center justify-center transition"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Maqsadni o'chirish"
          className="h-9 w-9 rounded-lg border border-border bg-card text-tertiary hover:text-destructive hover:border-destructive/40 inline-flex items-center justify-center transition"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Bo'limlari — bola maqsadlar (kunlik scope'da bola yo'q) */}
      {childScopeLabel && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-[11px] uppercase tracking-wider text-tertiary hover:text-foreground inline-flex items-center gap-1.5 transition"
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Bo'limlari ({children.length})
            </button>
            <button
              type="button"
              onClick={onAddChild}
              className="text-[11px] text-primary hover:text-primary/80 inline-flex items-center gap-1 transition"
            >
              <Plus size={11} /> {childScopeLabel}
            </button>
          </div>
          {expanded && children.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {children.map((c) => {
                const cProgress = c.cadence ? periodProgress(c) : (c.progress ?? 0);
                return (
                  <li
                    key={c.id}
                    className="rounded-lg bg-elevated/50 px-3 py-2 text-[12.5px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate">
                          <span className="text-tertiary text-[10px] uppercase tracking-wider mr-1.5">
                            {SCOPE_LABEL[c.scope]}
                          </span>
                          {c.title}
                        </p>
                      </div>
                      {c.timeOfDay && (
                        <span className="shrink-0 text-[10px] text-primary tabular inline-flex items-center gap-0.5">
                          <Clock size={9} />
                          {c.timeOfDay}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-background/60 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, cProgress * 100))}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {expanded && children.length === 0 && (
            <p className="mt-2 text-[11px] text-tertiary text-center py-3 font-serif italic">
              Hali bo'lim yo'q — yuqoridagi tugma bilan qo'shing
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// Haftalik tarmoq — Du..Yak, har kun bajarilganligini ko'rsatadi
function WeekStrip({ goal }: { goal: Goal }) {
  // Joriy hafta — Dushanbadan
  const now = new Date();
  const day = now.getDay();
  const daysFromMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  // Kunning rejaga to'g'ri kelishini tekshirish (cadence asosida)
  const dayMatchesCadence = (d: Date): boolean => {
    if (!goal.cadence) return true;
    if (goal.cadence.kind === "specific") return goal.cadence.days.includes(d.getDay());
    if (goal.cadence.kind === "monthly_specific")
      return goal.cadence.daysOfMonth.includes(d.getDate());
    return true;
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const isDone = goal.completedDates.includes(iso);
    const isPast = d.getTime() < now.setHours(0, 0, 0, 0);
    const isFuture = d.toDateString() !== new Date().toDateString() && !isPast;
    const isScheduled = dayMatchesCadence(d);
    return { iso, label: WEEKDAYS_SHORT[i], isDone, isFuture, isScheduled };
  });

  return (
    <div className="mt-3 grid grid-cols-7 gap-1">
      {days.map((d) => (
        <div
          key={d.iso}
          className={`py-1.5 rounded-md text-center text-[10px] tabular ${
            d.isDone
              ? "bg-primary/80 text-primary-foreground font-semibold"
              : d.isScheduled
                ? d.isFuture
                  ? "bg-elevated/60 text-tertiary"
                  : "bg-elevated text-foreground"
                : "bg-elevated/40 text-tertiary/50"
          }`}
          title={d.isScheduled ? "Rejada" : "Bu kun rejada yo'q"}
        >
          {d.label}
        </div>
      ))}
    </div>
  );
}
