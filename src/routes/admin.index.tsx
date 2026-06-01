import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Sparkles,
  MessageCircle,
  TrendingUp,
  DollarSign,
  Activity,
  AlertTriangle,
  Megaphone,
  FileText,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useAdminStats } from "@/lib/hooks/use-admin-api";

// Kunlik AI xarajat chegarasi — bundan oshsa Dashboard'da ogohlantirish chiqadi
const DAILY_COST_THRESHOLD_USD = 5.0;

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: stats, isLoading, isError, error, refetch, isFetching } = useAdminStats();
  const cards = [
    { label: "Jami foydalanuvchilar", value: stats?.totalUsers ?? 0, icon: Users, suffix: "" },
    { label: "Aktiv (24 soat)", value: stats?.activeUsers ?? 0, icon: Activity, suffix: "" },
    { label: "Premium foydalanuvchilar", value: stats?.premiumUsers ?? 0, icon: Sparkles, suffix: "" },
    { label: "AI xabarlar (bugun)", value: stats?.totalMessages ?? 0, icon: MessageCircle, suffix: "" },
    { label: "AI xarajat (bugun)", value: stats?.aiCostToday ?? 0, icon: DollarSign, suffix: "$" },
    { label: "AI xarajat (oy)", value: stats?.aiCostThisMonth ?? 0, icon: DollarSign, suffix: "$" },
    { label: "Yangi ro'yxat (bugun)", value: stats?.newSignupsToday ?? 0, icon: TrendingUp, suffix: "" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-[28px] text-foreground">Dashboard</h1>
          <p className="text-[13px] text-tertiary mt-1">
            Niyat ilovasi umumiy holati
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Yangilash"
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-card border border-border text-[12px] text-foreground hover:bg-elevated disabled:opacity-50 transition"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          {isFetching ? "Yangilanyapti..." : "Yangilash"}
        </button>
      </div>

      {/* Backend xato bo'lsa banner */}
      {isError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-[13px] text-destructive">
          Backend ulanmadi: {error instanceof Error ? error.message : "noma'lum xato"}
        </div>
      )}

      {/* Kunlik AI xarajat alert */}
      {stats && stats.aiCostToday > DAILY_COST_THRESHOLD_USD && (
        <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-destructive">
              Kunlik AI xarajat chegarasi oshib ketdi
            </p>
            <p className="text-[12px] text-destructive/80 mt-0.5 leading-relaxed">
              Bugun ${stats.aiCostToday.toFixed(2)} sarflandi — chegara $
              {DAILY_COST_THRESHOLD_USD.toFixed(2)}. AI loglarni tekshiring va
              kerak bo'lsa rate limit qo'shing.
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, suffix }) => (
          <div key={label} className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-tertiary">
                {label}
              </p>
              <Icon size={16} className="text-primary" />
            </div>
            <p className="mt-3 font-serif text-[28px] tabular text-foreground">
              {suffix}
              {isLoading ? "—" : value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions + Backend status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-card border border-border p-5">
          <h2 className="text-[15px] font-semibold text-foreground">
            Tezkor amallar
          </h2>
          <ul className="mt-3 space-y-2 text-[13px]">
            <li>
              <Link
                to="/admin/announcements"
                className="flex items-center justify-between rounded-xl bg-elevated hover:bg-elevated/70 px-3 py-2.5 transition group"
              >
                <span className="inline-flex items-center gap-2 text-foreground">
                  <Megaphone size={14} className="text-primary" />
                  Barcha foydalanuvchilarga e'lon yuborish
                </span>
                <ChevronRight
                  size={14}
                  className="text-tertiary group-hover:text-primary transition"
                />
              </Link>
            </li>
            <li>
              <Link
                to="/admin/users"
                className="flex items-center justify-between rounded-xl bg-elevated hover:bg-elevated/70 px-3 py-2.5 transition group"
              >
                <span className="inline-flex items-center gap-2 text-foreground">
                  <Sparkles size={14} className="text-primary" />
                  Premium qo'lda berish
                </span>
                <ChevronRight
                  size={14}
                  className="text-tertiary group-hover:text-primary transition"
                />
              </Link>
            </li>
            <li>
              <Link
                to="/admin/users"
                className="flex items-center justify-between rounded-xl bg-elevated hover:bg-elevated/70 px-3 py-2.5 transition group"
              >
                <span className="inline-flex items-center gap-2 text-foreground">
                  <Users size={14} className="text-primary" />
                  Foydalanuvchilarni ko'rish
                </span>
                <ChevronRight
                  size={14}
                  className="text-tertiary group-hover:text-primary transition"
                />
              </Link>
            </li>
            <li>
              <Link
                to="/admin/ai-logs"
                className="flex items-center justify-between rounded-xl bg-elevated hover:bg-elevated/70 px-3 py-2.5 transition group"
              >
                <span className="inline-flex items-center gap-2 text-foreground">
                  <Activity size={14} className="text-primary" />
                  AI loglar va xarajat tahlili
                </span>
                <ChevronRight
                  size={14}
                  className="text-tertiary group-hover:text-primary transition"
                />
              </Link>
            </li>
            <li>
              <Link
                to="/admin/content"
                className="flex items-center justify-between rounded-xl bg-elevated hover:bg-elevated/70 px-3 py-2.5 transition group"
              >
                <span className="inline-flex items-center gap-2 text-foreground">
                  <FileText size={14} className="text-primary" />
                  Kontentni boshqarish
                </span>
                <ChevronRight
                  size={14}
                  className="text-tertiary group-hover:text-primary transition"
                />
              </Link>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5">
          <h2 className="text-[15px] font-semibold text-foreground">
            Backend holati
          </h2>
          <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground">
            <li className="flex items-center justify-between">
              <span>Server (Workers/Dev)</span>
              <span className="text-primary text-[11px]">✓ Ulangan</span>
            </li>
            <li className="flex items-center justify-between">
              <span>D1 ma'lumotlar bazasi</span>
              <span
                className={
                  !isError && stats
                    ? "text-primary text-[11px]"
                    : "text-destructive text-[11px]"
                }
              >
                {!isError && stats ? "✓ Ulangan" : "✗ Ulanmadi"}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span>Auth endpoints</span>
              <span className="text-primary text-[11px]">✓ Ishlamoqda</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Admin endpoints</span>
              <span className="text-primary text-[11px]">✓ Ishlamoqda</span>
            </li>
            <li className="flex items-center justify-between">
              <span>AI proxy (Gemini/OpenAI)</span>
              <span className="text-primary text-[11px]">✓ Ishlamoqda</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Push notifications (VAPID)</span>
              <span className="text-tertiary text-[11px]">⏳ Sozlanmagan</span>
            </li>
          </ul>
          <p className="mt-4 text-[11px] text-tertiary leading-relaxed">
            Push notifications uchun .env'ga VAPID kalitlarni qo'shing
            (npx web-push generate-vapid-keys).
          </p>
        </div>
      </div>
    </div>
  );
}
