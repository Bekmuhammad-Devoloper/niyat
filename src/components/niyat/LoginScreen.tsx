import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, KeyRound, Phone } from "lucide-react";
import { NiyatLogo } from "./Logo";
import {
  cleanPhone,
  formatPhone,
  verifyPassword,
  type UserProfile,
} from "@/lib/hooks/use-user-profile";
import { useAuthApi, isAuthError } from "@/lib/hooks/use-auth-api";

// Logout'dan keyin foydalanuvchi qayta kirish uchun ko'rsatiladi.
// Telefon + parol localStorage'dagi profilga moslashtiriladi.
// Eslatma: bu lokal auth — boshqa qurilmada hisob yo'q.
export function LoginScreen({
  profile,
  onLoginSuccess,
  onReset,
}: {
  profile: UserProfile;
  onLoginSuccess: () => void;
  onReset: () => void;
}) {
  const [phoneRaw, setPhoneRaw] = useState(formatPhone(profile.phone));
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(false);
  const authApi = useAuthApi();

  const canSubmit = cleanPhone(phoneRaw).length === 13 && password.length > 0 && !checking;

  const submit = async () => {
    if (!canSubmit) return;
    setChecking(true);
    try {
      const phone = cleanPhone(phoneRaw);
      // 1) Avval backend orqali login — agar backend bor bo'lsa
      try {
        await authApi.login({ phone, password });
        // Backend mos kelganda — token saqlandi va server'dagi ma'lumotlar
        // (maqsadlar, niyatlar) lokal'ga ko'chirildi. Sahifani yangilash
        // kerak — komponentlar yangi localStorage'ni ko'rishi uchun.
        onLoginSuccess();
        // Kichik kutish — toast ko'rinishi uchun
        setTimeout(() => window.location.reload(), 300);
        return;
      } catch (err) {
        if (isAuthError(err) && err.backendDown) {
          // Backend ulanmagan — lokal verify bilan davom etamiz
        } else if (isAuthError(err) && err.status === 401) {
          // Backend bor, lekin parol noto'g'ri
          toast.error("Telefon yoki parol noto'g'ri");
          return;
        }
      }
      // 2) Lokal fallback — backend yo'q yoki tushib qolgan
      if (phone !== profile.phone) {
        toast.error("Bu telefon raqam bu qurilmada ro'yxatdan o'tmagan");
        return;
      }
      const ok = await verifyPassword(password, profile.passwordHash);
      if (!ok) {
        toast.error("Parol noto'g'ri");
        return;
      }
      // Lokal login muvaffaqiyatli — backend'ga ham register qilamiz
      // (eski qurilmada onboarding qilingan, lekin backend'da yo'q bo'lgan
      // foydalanuvchilarni avtomatik sinxronlash uchun)
      try {
        await authApi.register({
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone,
          password,
        });
        // Sinxron muvaffaqiyatli — toast
        toast.success("Hisob serverga bog'landi");
      } catch (err) {
        // 409 (allaqachon bor) yoki 503 (backend yo'q) — jim'ga olamiz
        if (isAuthError(err) && !err.backendDown && err.status !== 409) {
          console.warn("[login] backend register failed:", err.message);
        }
      }
      onLoginSuccess();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="mb-4">
          <NiyatLogo size={64} rounded={18} />
        </div>
        <h1 className="font-serif text-[26px] text-foreground leading-tight">
          Qaytib keldingiz
          {profile.firstName && profile.firstName !== "do'st" ? `, ${profile.firstName}` : ""}
        </h1>
        <p className="mt-2 font-serif italic text-[13px] text-muted-foreground max-w-[300px]">
          Telefon va parol bilan kiring
        </p>

        <form
          className="mt-8 w-full max-w-[320px] space-y-3 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="block">
            <span className="text-[12px] text-tertiary">Telefon raqam</span>
            <div className="relative mt-1">
              <Phone
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary"
                aria-hidden
              />
              <input
                type="tel"
                inputMode="numeric"
                value={phoneRaw}
                onChange={(e) => setPhoneRaw(formatPhone(e.target.value))}
                placeholder="+998 90 123 45 67"
                className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 text-[16px] tabular text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 transition"
              />
            </div>
          </label>

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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Parolingiz"
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

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold disabled:opacity-40 active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
          >
            {checking ? "Tekshirilmoqda..." : "Kirish"}
            {!checking && <ArrowRight size={16} />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Parolni unutdingizmi? Hisobni nollab, qaytadan ro'yxatdan o'tasiz. Saqlangan niyat va statistika qoladi, lekin yangi parol o'rnatishingiz kerak.",
                )
              ) {
                onReset();
              }
            }}
            className="mt-1 w-full text-[12px] text-tertiary hover:text-primary transition"
          >
            Parolni unutdingizmi?
          </button>
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
