import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Calendar, Sparkles } from "lucide-react";
import { DAILY_QURAN_SURAHS, ZAM_SURAHS } from "@/lib/niyat-data";

export const Route = createFileRoute("/admin/content")({
  component: ContentPage,
});

function ContentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] text-foreground">Kontent</h1>
        <p className="text-[13px] text-tertiary mt-1">
          Ilovadagi statik ma'lumotlar (suralar, sunnatlar, AI prompt'lar)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Quran rotation */}
        <section className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-primary" />
              <h2 className="text-[15px] font-semibold text-foreground">
                Kunlik tavsiya etilgan suralar
              </h2>
            </div>
            <span className="text-[10px] text-tertiary uppercase">
              {DAILY_QURAN_SURAHS.length} ta
            </span>
          </div>
          <p className="text-[12px] text-tertiary mb-3">
            Bugungi tavsiya rotatsiyasi. Hozirda kod ichida — kelajakda admin
            bu yerdan o'zgartira oladi.
          </p>
          <ul className="space-y-1">
            {DAILY_QURAN_SURAHS.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg bg-elevated/50 px-3 py-2 text-[12px]"
              >
                <span className="text-foreground">
                  <span className="text-tertiary tabular mr-2">{s.number}.</span>
                  {s.latin}
                </span>
                <span className="font-arabic text-quran text-[14px] text-primary" dir="rtl">
                  {s.arabic}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Zam surahs */}
        <section className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-primary" />
              <h2 className="text-[15px] font-semibold text-foreground">
                Zam suralar
              </h2>
            </div>
            <span className="text-[10px] text-tertiary uppercase">
              {ZAM_SURAHS.length} ta
            </span>
          </div>
          <p className="text-[12px] text-tertiary mb-3">
            Juz Amma'dan qisqa suralar. Bugungi takror uchun.
          </p>
          <ul className="space-y-1">
            {ZAM_SURAHS.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg bg-elevated/50 px-3 py-2 text-[12px]"
              >
                <span className="text-foreground">
                  <span className="text-tertiary tabular mr-2">{s.number}.</span>
                  {s.latin}
                </span>
                <span className="font-arabic text-quran text-[14px] text-primary" dir="rtl">
                  {s.arabic}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* AI Prompt */}
      <section className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-primary" />
          <h2 className="text-[15px] font-semibold text-foreground">
            AI Murabbiy system prompt
          </h2>
        </div>
        <p className="text-[12px] text-tertiary mb-3">
          Murabbiy uchun asosiy ko'rsatma. Hozirda kod ichida — kelajakda admin
          bu yerdan o'zgartira oladi (cache TTL hisobiga ehtiyot bilan).
        </p>
        <div className="rounded-lg bg-elevated p-3 text-[11px] text-muted-foreground font-mono max-h-40 overflow-y-auto">
          src/lib/api/coach-system-prompt.ts
        </div>
        <button
          type="button"
          disabled
          className="mt-3 px-4 py-2 rounded-lg bg-primary/30 text-primary-foreground/60 text-[12px] cursor-not-allowed"
        >
          Tahrirlash (backend kerak)
        </button>
      </section>

      {/* Sunnats */}
      <section className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={16} className="text-primary" />
          <h2 className="text-[15px] font-semibold text-foreground">
            Sahihi Buxoriy sunnatlar
          </h2>
        </div>
        <p className="text-[12px] text-tertiary">
          1256 ta bob — public/data/bukhoriy-1.json'da saqlangan (2.8 MB)
        </p>
        <p className="text-[11px] text-tertiary mt-2 leading-relaxed">
          Yangilash uchun: data/parse-bukhoriy.mjs ishga tushiring va JSON'ni
          qayta yarating. Keyin git commit + push.
        </p>
      </section>
    </div>
  );
}
