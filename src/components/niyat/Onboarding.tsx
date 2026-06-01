import { useState } from "react";
import { ArrowRight, ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { autoCapitalize } from "@/lib/text-utils";
import { NiyatLogo } from "./Logo";
import { formatPhone, cleanPhone } from "@/lib/hooks/use-user-profile";

export type OnboardingResult = {
  firstName: string;
  lastName: string;
  phone: string;
  password: string; // ochiq matn — useUserProfile darajasida hashlanadi
  niyat: string;
};

// 4 qadamli onboarding:
// 0) Ism + Familiya
// 1) Telefon raqam
// 2) Parol yaratish (min 6 belgi)
// 3) Bugungi niyat

type Step = 0 | 1 | 2 | 3;

const MIN_PASSWORD_LEN = 6;

export function Onboarding({
  initialFirstName,
  onDone,
}: {
  initialFirstName: string;
  onDone: (result: OnboardingResult) => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [firstName, setFirstName] = useState(
    initialFirstName === "do'st" ? "" : initialFirstName,
  );
  const [lastName, setLastName] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("+998 ");
  const [password, setPassword] = useState("");
  const [niyat, setNiyatDraft] = useState("");

  const canGo = (): boolean => {
    if (step === 0) return firstName.trim().length > 0 && lastName.trim().length > 0;
    if (step === 1) return cleanPhone(phoneRaw).length === 13; // +998xxxxxxxxx
    if (step === 2) return password.length >= MIN_PASSWORD_LEN;
    return true;
  };

  const next = () => {
    if (!canGo()) return;
    if (step === 3) {
      onDone({
        firstName: firstName.trim() || "do'st",
        lastName: lastName.trim(),
        phone: cleanPhone(phoneRaw),
        password,
        niyat: niyat.trim(),
      });
      return;
    }
    setStep((s) => (s + 1) as Step);
  };

  const back = () => {
    if (step === 0) return;
    setStep((s) => (s - 1) as Step);
  };

  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col">
      {/* Progress bar */}
      <div className="px-8 pt-8">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`flex-1 h-1 rounded-full transition-all ${
                i <= step ? "bg-primary" : "bg-elevated"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="mb-4">
          <NiyatLogo size={64} rounded={18} />
        </div>
        <h1 className="font-serif text-[26px] text-foreground leading-tight">
          {step === 0 && "Niyat'ga xush kelibsiz"}
          {step === 1 && "Telefon raqamingiz"}
          {step === 2 && "Parol yarating"}
          {step === 3 && `Bugungi niyat${firstName ? `, ${firstName}` : ""}`}
        </h1>
        <p className="mt-2 font-serif italic text-[13px] text-muted-foreground max-w-[300px]">
          {step === 0 && "“Amallar niyatlarga qarab baholanadi.”"}
          {step === 1 && "Hisobingizga keyin kirish uchun"}
          {step === 2 && "Kamida 6 ta belgidan iborat parol o'ylab toping"}
          {step === 3 && "Bugun bajariladigan kichik, aniq qadam"}
        </p>

        <form
          className="mt-8 w-full max-w-[320px]"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          {step === 0 && (
            <NameStep
              firstName={firstName}
              lastName={lastName}
              onFirstName={setFirstName}
              onLastName={setLastName}
            />
          )}
          {step === 1 && <PhoneStep value={phoneRaw} onChange={setPhoneRaw} />}
          {step === 2 && <PasswordStep value={password} onChange={setPassword} />}
          {step === 3 && <NiyatStep value={niyat} onChange={setNiyatDraft} />}

          <div className="mt-4 flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="h-12 px-4 rounded-xl bg-card border border-border text-foreground text-[13px] inline-flex items-center gap-1 hover:bg-elevated transition"
              >
                <ArrowLeft size={14} /> Orqaga
              </button>
            )}
            <button
              type="submit"
              disabled={!canGo()}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold disabled:opacity-40 active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
            >
              {step === 3 ? "Boshlash" : "Davom etish"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>

      <div className="px-8 pb-8 text-center">
        <p className="text-[10px] text-tertiary">
          Niyat — musulmon yoshlar uchun AI hayot murabbiyi
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Steps
// ============================================================

function NameStep({
  firstName,
  lastName,
  onFirstName,
  onLastName,
}: {
  firstName: string;
  lastName: string;
  onFirstName: (v: string) => void;
  onLastName: (v: string) => void;
}) {
  return (
    <div className="space-y-3 text-left">
      <label className="block">
        <span className="text-[12px] text-tertiary">Ism</span>
        <input
          type="text"
          value={firstName}
          onChange={(e) => onFirstName(autoCapitalize(e.target.value))}
          maxLength={40}
          autoFocus
          autoCapitalize="words"
          placeholder="Bekmuhammad"
          className="mt-1 w-full bg-card border border-border rounded-xl px-4 py-3 text-[16px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 transition"
        />
      </label>
      <label className="block">
        <span className="text-[12px] text-tertiary">Familiya</span>
        <input
          type="text"
          value={lastName}
          onChange={(e) => onLastName(autoCapitalize(e.target.value))}
          maxLength={40}
          autoCapitalize="words"
          placeholder="Shokirjonov"
          className="mt-1 w-full bg-card border border-border rounded-xl px-4 py-3 text-[16px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 transition"
        />
      </label>
    </div>
  );
}

function PhoneStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handleChange = (raw: string) => {
    onChange(formatPhone(raw));
  };
  return (
    <div className="text-left">
      <label className="block">
        <span className="text-[12px] text-tertiary">Telefon raqam</span>
        <input
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          autoFocus
          placeholder="+998 90 123 45 67"
          className="mt-1 w-full bg-card border border-border rounded-xl px-4 py-3 text-[18px] tabular text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 transition"
        />
      </label>
      <p className="mt-3 text-[11px] text-tertiary">
        Bu telefon hisobingizning identifikatori bo'ladi. Keyin shu raqam va parol
        bilan kirasiz.
      </p>
    </div>
  );
}

function PasswordStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const tooShort = value.length > 0 && value.length < MIN_PASSWORD_LEN;
  return (
    <div className="text-left">
      <label className="block">
        <span className="text-[12px] text-tertiary">Parol</span>
        <div className="relative mt-1">
          <KeyRound
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary"
            aria-hidden
          />
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            autoComplete="new-password"
            placeholder="Kamida 6 ta belgi"
            className="w-full bg-card border border-border rounded-xl pl-11 pr-12 py-3 text-[16px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 transition"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-foreground transition"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>
      {tooShort ? (
        <p className="mt-2 text-[11px] text-destructive">
          Kamida {MIN_PASSWORD_LEN} ta belgi kerak
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-tertiary">
          Parolingizni eslab qoling — uni faqat siz bilasiz, biz tiklab bera olmaymiz.
        </p>
      )}
    </div>
  );
}

function NiyatStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="text-left">
      <label className="block">
        <span className="text-[12px] text-tertiary">Bugungi niyatingiz</span>
        <textarea
          value={value}
          onChange={(e) => onChange(autoCapitalize(e.target.value))}
          maxLength={240}
          autoFocus
          autoCapitalize="sentences"
          rows={3}
          placeholder="Masalan: Bugun bomdoddan keyin Instagram ochmayman."
          className="mt-1 w-full bg-card border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 transition resize-none font-serif"
        />
      </label>
    </div>
  );
}
