import { useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  CheckCircle2,
} from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { NAMOZLAR, type Namoz, type PrayerPosition } from "@/lib/data/namoz-guide";

// ============================================================
// Custom Namoz iconlari — har bir namoz vaqtiga moslangan
// gradient va vizual elementlar bilan
// ============================================================

function BomdodIcon() {
  // Tong otishi — quyosh ufq ortidan ko'tarilyapti, pushti-to'q sariq
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="bomdod-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
          <stop offset="60%" stopColor="#f97316" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ec4899" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id="bomdod-sun" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      {/* Osmon foni */}
      <circle cx="24" cy="24" r="22" fill="url(#bomdod-sky)" />
      {/* Quyosh — yarim ko'rinadi (ufqdan ko'tarilyapti) */}
      <circle cx="24" cy="34" r="9" fill="url(#bomdod-sun)" />
      {/* Quyosh nurlari */}
      <g stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
        <line x1="24" y1="14" x2="24" y2="18" />
        <line x1="14" y1="24" x2="11" y2="24" />
        <line x1="34" y1="24" x2="37" y2="24" />
        <line x1="16" y1="18" x2="14" y2="16" />
        <line x1="32" y1="18" x2="34" y2="16" />
      </g>
      {/* Ufq chizig'i */}
      <line x1="6" y1="34" x2="42" y2="34" stroke="#78350f" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

function PeshinIcon() {
  // Quyosh tepada — eng yorug', tilla rang
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden>
      <defs>
        <radialGradient id="peshin-sun" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
      </defs>
      {/* Tashqi yorug'lik halqasi */}
      <circle cx="24" cy="24" r="22" fill="#fbbf24" opacity="0.08" />
      <circle cx="24" cy="24" r="18" fill="#fbbf24" opacity="0.12" />
      {/* Asosiy quyosh */}
      <circle cx="24" cy="24" r="9" fill="url(#peshin-sun)" />
      {/* 8 ta nur (yulduzga o'xshash) */}
      <g stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
        <line x1="24" y1="6" x2="24" y2="11" />
        <line x1="24" y1="37" x2="24" y2="42" />
        <line x1="6" y1="24" x2="11" y2="24" />
        <line x1="37" y1="24" x2="42" y2="24" />
        <line x1="11" y1="11" x2="14.5" y2="14.5" />
        <line x1="33.5" y1="33.5" x2="37" y2="37" />
        <line x1="37" y1="11" x2="33.5" y2="14.5" />
        <line x1="11" y1="37" x2="14.5" y2="33.5" />
      </g>
    </svg>
  );
}

function AsrIcon() {
  // Tushdan keyin — quyosh past, soyalar uzun, oltin-tilla rang
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="asr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id="asr-sun">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#asr-sky)" />
      {/* Quyosh — o'ng yuqorida, past holatda */}
      <circle cx="32" cy="20" r="7" fill="url(#asr-sun)" />
      <g stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" opacity="0.7">
        <line x1="32" y1="10" x2="32" y2="12" />
        <line x1="40" y1="20" x2="42" y2="20" />
        <line x1="38" y1="14" x2="40" y2="12" />
        <line x1="38" y1="26" x2="40" y2="28" />
      </g>
      {/* Uzun soya — minora yoki daraxt */}
      <path d="M 14 36 L 14 22 L 17 22 L 17 36 Z" fill="#451a03" opacity="0.5" />
      <path d="M 17 36 L 28 36 L 26 33 L 17 33 Z" fill="#451a03" opacity="0.35" />
      <line x1="6" y1="36" x2="42" y2="36" stroke="#78350f" strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}

function ShomIcon() {
  // Quyosh botishi — qizg'ish-binafsha, ufqqa singib bormoqda
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="shom-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.4" />
          <stop offset="40%" stopColor="#ec4899" stopOpacity="0.45" />
          <stop offset="80%" stopColor="#f97316" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id="shom-sun">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="60%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#9a3412" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#shom-sky)" />
      {/* Quyosh — yarmi ufq ostida (botayotgan) */}
      <circle cx="24" cy="32" r="8" fill="url(#shom-sun)" />
      {/* Ufq chizig'i — quyoshni yarim yashiradi */}
      <rect x="0" y="34" width="48" height="14" fill="#0c0a09" opacity="0.55" />
      <line x1="4" y1="34" x2="44" y2="34" stroke="#fb923c" strokeWidth="1.5" opacity="0.7" />
      {/* Bulutlar */}
      <ellipse cx="14" cy="20" rx="6" ry="2" fill="#be185d" opacity="0.5" />
      <ellipse cx="34" cy="14" rx="5" ry="1.8" fill="#9d174d" opacity="0.5" />
    </svg>
  );
}

function XuftonIcon() {
  // Tun — to'la qora osmon, oy va yulduzlar
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden>
      <defs>
        <radialGradient id="xufton-sky" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <radialGradient id="xufton-moon">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="100%" stopColor="#fde047" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#xufton-sky)" />
      {/* Yarim oy (Islom ramzi) */}
      <g transform="translate(28, 18)">
        <circle cx="0" cy="0" r="8" fill="url(#xufton-moon)" />
        {/* Soya bilan yarim oy effekti */}
        <circle cx="3" cy="-1" r="7" fill="#020617" />
      </g>
      {/* Yulduzlar */}
      <g fill="#fef9c3">
        <circle cx="12" cy="14" r="0.9" opacity="0.9" />
        <circle cx="18" cy="32" r="0.7" opacity="0.7" />
        <circle cx="36" cy="30" r="0.8" opacity="0.85" />
        <circle cx="10" cy="26" r="0.6" opacity="0.6" />
        <circle cx="14" cy="36" r="0.7" opacity="0.7" />
        <circle cx="38" cy="38" r="0.65" opacity="0.7" />
      </g>
      {/* Katta yulduz */}
      <g transform="translate(13, 30)" fill="#fef08a" opacity="0.9">
        <path d="M 0 -2 L 0.5 -0.5 L 2 0 L 0.5 0.5 L 0 2 L -0.5 0.5 L -2 0 L -0.5 -0.5 Z" />
      </g>
    </svg>
  );
}

const NAMOZ_ICONS: Record<string, () => React.ReactElement> = {
  bomdod: BomdodIcon,
  peshin: PeshinIcon,
  asr: AsrIcon,
  shom: ShomIcon,
  xufton: XuftonIcon,
};

// Har bir namoz uchun fon rangi (icon konteyneri)
const NAMOZ_BG: Record<string, string> = {
  bomdod:
    "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(236,72,153,0.10))",
  peshin: "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.12))",
  asr: "linear-gradient(135deg, rgba(217,119,6,0.15), rgba(69,26,3,0.10))",
  shom: "linear-gradient(135deg, rgba(236,72,153,0.18), rgba(124,58,237,0.12))",
  xufton: "linear-gradient(135deg, rgba(30,27,75,0.5), rgba(2,6,23,0.3))",
};

const POSITION_LABELS: Record<PrayerPosition, string> = {
  niyat: "Niyat",
  qiyom: "Qiyom (tik turish)",
  ruku: "Ruku (egilish)",
  qowma: "Qowma (turish)",
  sajda: "Sajda (yerga bosh)",
  jalsa: "Jalsa (o'tirish)",
  tashahhud: "Tashahhud (o'tirish)",
  salom: "Salom",
};
// === Step illustratsiyalari olib tashlandi — faqat matn ko'rinishi ===

export function NamozLearnSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Namoz | null>(null);
  const [rakaatIdx, setRakaatIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [audioOn, setAudioOn] = useState(false);

  // Sheet yopilganda holatni reset qilamiz — qaytadan ochilganda namoz tanlash boshlanadi
  const handleClose = () => {
    setSelected(null);
    setRakaatIdx(0);
    setStepIdx(0);
    setAudioOn(false);
    onClose();
  };

  const handleSelectNamoz = (n: Namoz) => {
    setSelected(n);
    setRakaatIdx(0);
    setStepIdx(0);
  };

  const speak = (text: string) => {
    if (!audioOn) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "ar-SA";
      utter.rate = 0.85;
      window.speechSynthesis.speak(utter);
    } catch {
      /* ignore */
    }
  };

  if (!selected) {
    return (
      <BottomSheet open={open} onClose={handleClose} title="Namoz o'qishni o'rganish" fullHeight>
        <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
          Hanafiy mazhabi bo'yicha 5 vaqt farz namozi. Qaysi namozni
          o'rganmoqchisiz?
        </p>
        <div className="space-y-2">
          {NAMOZLAR.map((n) => {
            const Icon = NAMOZ_ICONS[n.id];
            const bg = NAMOZ_BG[n.id] ?? "rgba(255,255,255,0.05)";
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleSelectNamoz(n)}
                className="w-full text-left rounded-2xl bg-card border border-border p-4 flex items-center justify-between hover:border-primary/40 transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-border/50"
                    style={{ background: bg }}
                  >
                    {Icon ? <Icon /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-semibold text-foreground">
                        {n.name}
                      </p>
                      <span className="text-[10px] tabular text-tertiary">
                        {n.rakaats} rakat farz
                      </span>
                    </div>
                    <p className="text-[11px] text-tertiary mt-0.5">{n.timeDesc}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p
                    className="font-arabic text-quran text-[16px] text-primary"
                    dir="rtl"
                  >
                    {n.arabicName}
                  </p>
                  <p className="text-[10px] text-tertiary mt-0.5">
                    {n.recitation === "jahriy" ? "jahriy" : "sirli"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl bg-elevated/40 border border-border p-4 text-[11px] text-tertiary leading-relaxed space-y-2">
          <p className="text-foreground font-semibold">Qisqa qoidalar:</p>
          <p>
            • <span className="text-foreground">Jahriy</span> — Fotiha va zam sura
            ovozli o'qiladi (Bomdod, Shom, Xufton'ning farzlari).
          </p>
          <p>
            • <span className="text-foreground">Sirli</span> — ichida o'qiladi
            (Peshin, Asr farzlari va barcha sunnatlar).
          </p>
          <p>
            • <span className="text-foreground">Zam sura</span> faqat birinchi 2
            rakatda o'qiladi. 3 va 4-rakatda faqat Fotiha.
          </p>
        </div>
      </BottomSheet>
    );
  }

  const rakaat = selected.steps[rakaatIdx];
  const step = rakaat.steps[stepIdx];
  const totalRakaats = selected.steps.length;
  const totalStepsThisRakaat = rakaat.steps.length;
  const stepsBefore = selected.steps
    .slice(0, rakaatIdx)
    .reduce((sum, r) => sum + r.steps.length, 0);
  const globalStep = stepsBefore + stepIdx + 1;
  const totalSteps = selected.steps.reduce((sum, r) => sum + r.steps.length, 0);

  const isFirstStep = rakaatIdx === 0 && stepIdx === 0;
  const isLastStep = rakaatIdx === totalRakaats - 1 && stepIdx === totalStepsThisRakaat - 1;

  const goNext = () => {
    if (stepIdx < totalStepsThisRakaat - 1) {
      setStepIdx(stepIdx + 1);
    } else if (rakaatIdx < totalRakaats - 1) {
      setRakaatIdx(rakaatIdx + 1);
      setStepIdx(0);
    }
  };

  const goPrev = () => {
    if (stepIdx > 0) {
      setStepIdx(stepIdx - 1);
    } else if (rakaatIdx > 0) {
      const prevRakaat = selected.steps[rakaatIdx - 1];
      setRakaatIdx(rakaatIdx - 1);
      setStepIdx(prevRakaat.steps.length - 1);
    }
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title={`${selected.name} namozi`} fullHeight>
      <div className="space-y-4">
        {/* Top bar — orqaga + audio toggle */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1 text-[12px] text-tertiary hover:text-foreground transition"
          >
            <ChevronLeft size={14} /> Boshqa namoz tanlash
          </button>
          <button
            type="button"
            onClick={() => setAudioOn((v) => !v)}
            aria-label={audioOn ? "Audio o'chirish" : "Audio yoqish"}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition ${
              audioOn ? "bg-primary/15 text-primary" : "bg-elevated text-tertiary"
            }`}
          >
            {audioOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
            {audioOn ? "Audio yoq." : "Audio o'ch."}
          </button>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-tertiary tabular mb-1.5">
            <span>
              {rakaat.number}-rakat / {totalRakaats}
            </span>
            <span>
              {globalStep} / {totalSteps} qadam
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(globalStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step card */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-tertiary">
              {POSITION_LABELS[step.position]}
            </p>
            <p className="text-[18px] font-semibold text-foreground mt-1 leading-tight">
              {step.title}
            </p>
          </div>

          {step.arabic && (
            <div className="mt-4">
              <p
                className="font-arabic text-quran text-[22px] text-primary leading-loose text-right"
                dir="rtl"
              >
                {step.arabic}
              </p>
              {audioOn && (
                <button
                  type="button"
                  onClick={() => speak(step.arabic!)}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <Volume2 size={12} /> O'qib eshittirish
                </button>
              )}
            </div>
          )}

          {step.transliteration && (
            <div className="mt-3 rounded-lg bg-elevated/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-tertiary mb-1">
                Talaffuzi
              </p>
              <p className="text-[13px] text-foreground italic font-serif leading-relaxed">
                {step.transliteration}
              </p>
            </div>
          )}

          {step.translation && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-tertiary mb-1">
                Tarjima
              </p>
              <p className="text-[13px] text-foreground leading-relaxed">
                {step.translation}
              </p>
            </div>
          )}

          {step.note && (
            <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-primary mb-1">
                Eslatma
              </p>
              <p className="text-[12px] text-foreground leading-relaxed">
                {step.note}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={isFirstStep}
            className="flex-1 h-12 rounded-xl border border-border bg-card text-foreground text-[13px] disabled:opacity-40 flex items-center justify-center gap-1"
          >
            <ChevronLeft size={16} /> Oldingi
          </button>
          {isLastStep ? (
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center justify-center gap-1"
            >
              <CheckCircle2 size={16} /> Tugadi
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center justify-center gap-1"
            >
              Keyingi <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Rakat sakrash — uzun namozlarda foydali */}
        {totalRakaats > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {selected.steps.map((r, i) => (
              <button
                key={r.number}
                type="button"
                onClick={() => {
                  setRakaatIdx(i);
                  setStepIdx(0);
                }}
                className={`px-2.5 py-1 rounded-md text-[10px] tabular transition ${
                  i === rakaatIdx
                    ? "bg-primary text-primary-foreground font-semibold"
                    : i < rakaatIdx
                      ? "bg-primary/15 text-primary"
                      : "bg-elevated text-tertiary"
                }`}
              >
                {r.number}-rakat
              </button>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
