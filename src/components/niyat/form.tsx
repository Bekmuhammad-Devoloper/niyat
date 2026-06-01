import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

// =========================================================
// PickerWheel — dark-tema'ga mos custom dropdown.
// Native <select> o'rniga ishlatamiz, Windows/iOS default
// dropdownlari dizaynni buzmasligi uchun.
// =========================================================
export function Picker<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode; searchText?: string }>;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="w-full flex items-center justify-between bg-card border border-border rounded-xl px-3 py-3 text-[14px] text-foreground hover:border-primary/40 focus:border-primary/60 outline-none transition"
      >
        <span className="truncate">{current?.label ?? "—"}</span>
        <ChevronDown
          size={16}
          className={`text-tertiary shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto scrollbar-hide rounded-xl border border-border bg-card shadow-2xl py-1 fade-up"
          style={{ animationDuration: "150ms" }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={String(opt.value)}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  role="option"
                  aria-selected={active}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-[14px] text-left transition ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-elevated/60"
                  }`}
                >
                  <span>{opt.label}</span>
                  {active && <Check size={14} className="text-primary shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// =========================================================
// TimePicker — 24-soatlik vaqt tanlash. Soat (00-23) +
// daqiqa (00-55, 5 daqiqalik step).
// =========================================================
export function TimePicker({
  value, // "HH:mm"
  onChange,
  label = "Vaqt",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [h, m] = parseHMM(value);

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: String(i).padStart(2, "0"),
  }));
  const minuteOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i * 5,
    label: String(i * 5).padStart(2, "0"),
  }));

  const set = (nh: number, nm: number) => {
    onChange(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`);
  };

  return (
    <div className="flex items-center gap-2" aria-label={label}>
      <Picker
        value={h}
        onChange={(v) => set(v, m)}
        options={hourOptions}
        label="Soat"
        className="flex-1"
      />
      <span className="text-[18px] font-semibold text-foreground tabular">:</span>
      <Picker
        value={m}
        onChange={(v) => set(h, v)}
        options={minuteOptions}
        label="Daqiqa"
        className="flex-1"
      />
    </div>
  );
}

function parseHMM(v: string): [number, number] {
  const [h, m] = v.split(":").map((x) => Number(x));
  // Daqiqani 5-multiple ga yumaltirish (custom value bo'lsa ham mos kelsin).
  const safeM = Number.isFinite(m) ? Math.round(m / 5) * 5 : 0;
  return [Number.isFinite(h) ? h : 0, Math.min(55, safeM)];
}

// =========================================================
// Slider — input[type=range] o'rniga dark-tema slayder.
// =========================================================
export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative w-full" aria-label={label}>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="niyat-slider w-full"
        aria-label={label}
      />
      <div
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 left-0 h-1.5 bg-primary rounded-full"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
