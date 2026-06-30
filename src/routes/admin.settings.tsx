import { createFileRoute } from "@tanstack/react-router";
import { Lock, Key, Database, Cpu } from "lucide-react";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] text-foreground">Sozlamalar</h1>
        <p className="text-[13px] text-tertiary mt-1">
          Admin panel va backend konfiguratsiyasi
        </p>
      </div>

      <section className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lock size={16} className="text-primary" />
          <h2 className="text-[15px] font-semibold text-foreground">
            Admin auth
          </h2>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Admin paroli <code className="text-primary">.env</code> faylida
          <code className="text-primary ml-1">VITE_ADMIN_PASSWORD</code> orqali
          sozlanadi. Production'da bu kalit JWT bilan almashtirilishi kerak.
        </p>
      </section>

      <section className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Key size={16} className="text-primary" />
          <h2 className="text-[15px] font-semibold text-foreground">
            API kalitlar
          </h2>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
          Cloudflare Workers secrets'da saqlanadi (Wrangler bilan boshqariladi).
          Dev'da <code className="text-primary">.env</code> faylida.
        </p>
        <ul className="space-y-1 text-[12px]">
          {[
            { name: "GEMINI_API_KEY", label: "Gemini (asosiy AI)" },
            { name: "OPENAI_API_KEY", label: "OpenAI (fallback AI + TTS + Whisper STT)" },
            { name: "ADMIN_PASSWORD", label: "Admin paroli" },
          ].map((k) => (
            <li
              key={k.name}
              className="flex items-center justify-between rounded-lg bg-elevated/50 px-3 py-2"
            >
              <span className="text-foreground">
                {k.label} —{" "}
                <code className="text-tertiary text-[11px]">{k.name}</code>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-primary" />
          <h2 className="text-[15px] font-semibold text-foreground">
            Backend ulashlari
          </h2>
        </div>
        <ul className="space-y-2 text-[12px]">
          <li className="flex items-center justify-between rounded-lg bg-elevated/50 px-3 py-2.5">
            <span className="text-foreground">Cloudflare D1 (foydalanuvchilar)</span>
            <span className="text-tertiary text-[11px]">⏳ Sozlanmagan</span>
          </li>
          <li className="flex items-center justify-between rounded-lg bg-elevated/50 px-3 py-2.5">
            <span className="text-foreground">KV (cache)</span>
            <span className="text-tertiary text-[11px]">⏳ Sozlanmagan</span>
          </li>
          <li className="flex items-center justify-between rounded-lg bg-elevated/50 px-3 py-2.5">
            <span className="text-foreground">R2 (rasm/audio)</span>
            <span className="text-tertiary text-[11px]">⏳ Sozlanmagan</span>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Cpu size={16} className="text-primary" />
          <h2 className="text-[15px] font-semibold text-foreground">
            Texnik ma'lumot
          </h2>
        </div>
        <ul className="space-y-1 text-[12px] text-muted-foreground">
          <li>
            <strong className="text-foreground">Stack:</strong> TanStack Start +
            React 19 + Tailwind v4 + Cloudflare Workers
          </li>
          <li>
            <strong className="text-foreground">Mobile:</strong> Capacitor 8 (Android)
          </li>
          <li>
            <strong className="text-foreground">AI provayderlar:</strong> Gemini → OpenAI
            (fallback)
          </li>
          <li>
            <strong className="text-foreground">Tilovat audio:</strong> Quran.com API
          </li>
        </ul>
      </section>
    </div>
  );
}
