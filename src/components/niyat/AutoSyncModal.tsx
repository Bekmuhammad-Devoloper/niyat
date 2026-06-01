// Eski foydalanuvchilar uchun majburiy avto-sinxron modal.
// Foydalanuvchi backend yoq paytda ro'yxatdan o'tgan bo'lsa, bu modal ilovaga
// kirgan zahoti chiqadi va parol kiritib backendga bog'lanishni so'raydi.
// Yopib bo'lmaydi — boshqacha qutulish yo'q.

import { useState } from "react";
import { toast } from "sonner";
import { Cloud, KeyRound, Eye, EyeOff } from "lucide-react";
import { useAuthApi, isAuthError } from "@/lib/hooks/use-auth-api";

export function AutoSyncModal({
  firstName,
  lastName,
  phone,
}: {
  firstName: string;
  lastName: string;
  phone: string;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [show, setShow] = useState(false);
  const auth = useAuthApi();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    try {
      // Avval register — bizning telefon serverda yo'q bo'lishi mumkin
      try {
        await auth.register({ firstName, lastName, phone, password });
        toast.success("Hisob serverga bog'landi");
        return;
      } catch (err) {
        if (isAuthError(err) && err.status === 409) {
          // Server'da bor — login bilan urinish
          try {
            await auth.login({ phone, password });
            toast.success("Hisob serverga bog'landi");
            return;
          } catch {
            toast.error("Parol noto'g'ri");
            return;
          }
        }
        if (isAuthError(err) && err.backendDown) {
          toast.error("Server javob bermayapti. Internet bormi?");
          return;
        }
        toast.error(err instanceof Error ? err.message : "Xato");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/15 text-primary mb-3">
            <Cloud size={24} />
          </div>
          <h2 className="text-[18px] font-semibold text-foreground">
            Markaziy serverga bog'lanish
          </h2>
          <p className="text-[12px] text-tertiary mt-1.5 leading-relaxed">
            Boshqa qurilmadan kira olish va ma'lumotlarni saqlash uchun
            parolingizni qaytadan kiriting.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-[12px] text-tertiary">Parol</span>
            <div className="relative mt-1">
              <KeyRound
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary"
              />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                placeholder="Sizning parolingiz"
                className="w-full bg-elevated border border-border rounded-xl pl-11 pr-12 py-3 text-[16px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 transition"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Yashirish" : "Ko'rsatish"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-foreground"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={!password || submitting}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold disabled:opacity-40 active:scale-[0.98] transition"
          >
            {submitting ? "Bog'lanmoqda..." : "Bog'lanish"}
          </button>
        </form>

        <p className="text-[10px] text-tertiary text-center leading-relaxed">
          Telefon: <span className="tabular">{phone}</span>
          <br />
          Bu so'rov faqat 1 marta chiqadi. Parol Onboarding paytidagi bilan
          bir xil.
        </p>
      </div>
    </div>
  );
}
