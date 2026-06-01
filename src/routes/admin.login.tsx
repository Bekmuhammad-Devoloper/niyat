import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Admin · Niyat" }],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { isAuthenticated, login } = useAdminAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Allaqachon kirgan bo'lsa — dashboard'ga yo'naltir
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/admin" });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    const ok = login(password);
    setSubmitting(false);
    if (ok) {
      toast.success("Admin panelga kirildi");
      await navigate({ to: "/admin" });
    } else {
      toast.error("Parol noto'g'ri");
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/15 text-primary mb-3">
            <ShieldCheck size={24} />
          </div>
          <h1 className="font-serif text-[26px] text-foreground">Niyat Admin</h1>
          <p className="text-[13px] text-tertiary mt-1">
            Yuksalish.dev boshqaruv paneli
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-[12px] text-tertiary">Admin paroli</span>
            <div className="relative mt-1">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                placeholder="Parolingiz"
                className="w-full bg-card border border-border rounded-xl px-4 py-3 pr-11 text-[16px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 transition"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Parolni yashirish" : "Parolni ko'rsatish"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-foreground transition"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={!password || submitting}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold disabled:opacity-40 active:scale-[0.98] transition"
          >
            {submitting ? "Tekshirilmoqda..." : "Kirish"}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-tertiary">
          Parol .env'da <code className="text-primary">VITE_ADMIN_PASSWORD</code> sozlanadi
        </p>
      </div>
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{ className: "!bg-card !text-foreground !border-border" }}
      />
    </div>
  );
}
