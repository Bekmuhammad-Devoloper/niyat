import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Search, UserPlus, Server, Sparkles, X, ChevronRight } from "lucide-react";
import {
  useAdminUsers,
  useSetUserPremium,
  type AdminUser,
} from "@/lib/hooks/use-admin-api";

export const Route = createFileRoute("/admin/users/")({
  component: UsersPage,
});

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function UsersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error } = useAdminUsers({ search });
  const users = data?.users ?? [];
  const totalCount = data?.total ?? 0;
  const [premiumModal, setPremiumModal] = useState<AdminUser | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] text-foreground">
          Foydalanuvchilar
        </h1>
        <p className="text-[13px] text-tertiary mt-1">
          Jami: <span className="text-foreground tabular">{totalCount}</span>
        </p>
      </div>

      {/* Backend xato banner */}
      {isError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3">
          <Server size={18} className="text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-destructive">
              Backend xato
            </p>
            <p className="text-[12px] text-destructive/80 mt-0.5 leading-relaxed">
              {error instanceof Error ? error.message : "Ulanib bo'lmadi"}. D1 bazasi
              sozlanganmi tekshiring: <code>npx wrangler d1 list</code>
            </p>
          </div>
        </div>
      )}

      {/* Search + actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism, familiya yoki telefon..."
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60"
          />
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary/30 text-primary-foreground/60 text-[13px] font-semibold cursor-not-allowed"
          title="Backend kerak"
        >
          <UserPlus size={14} />
          Qo'lda qo'shish
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-elevated/50">
            <tr className="text-left text-[11px] uppercase tracking-wider text-tertiary">
              <th className="px-4 py-3">Ism</th>
              <th className="px-4 py-3 hidden sm:table-cell">Telefon</th>
              <th className="px-4 py-3 hidden md:table-cell">Ro'yxat</th>
              <th className="px-4 py-3 hidden md:table-cell">Premium</th>
              <th className="px-4 py-3 hidden lg:table-cell">Oxirgi aktiv</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <p className="text-[13px] text-tertiary">Yuklanyapti...</p>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <p className="text-[13px] text-tertiary">
                    {search ? "Topilmadi" : "Hozircha foydalanuvchilar yo'q"}
                  </p>
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-elevated/30 transition">
                  <td className="px-4 py-3 text-[13px] text-foreground">
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: u.id }}
                      className="hover:text-primary inline-flex items-center gap-1 transition"
                    >
                      {u.firstName} {u.lastName}
                      <ChevronRight size={12} className="text-tertiary" />
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-tertiary tabular hidden sm:table-cell">
                    {u.phone}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-tertiary hidden md:table-cell">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {u.isPremium ? (
                      <span className="text-[11px] text-primary font-semibold">
                        ✓ Premium
                      </span>
                    ) : u.premiumExpiresAt && u.premiumExpiresAt > Date.now() ? (
                      <span className="text-[11px] text-primary">
                        ✓ Sovg'a
                      </span>
                    ) : (
                      <span className="text-[11px] text-tertiary">Bepul</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-foreground tabular hidden lg:table-cell">
                    {formatDate(u.lastActiveAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setPremiumModal(u)}
                      aria-label="Premium boshqarish"
                      className="text-tertiary hover:text-primary transition"
                    >
                      <Sparkles size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {premiumModal && (
        <PremiumModal
          user={premiumModal}
          onClose={() => setPremiumModal(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Premium modal — user'ga sovg'a yoki doimiy berish/olib tashlash
// ============================================================
function PremiumModal({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const setPremium = useSetUserPremium();

  const grant = (days: number | "permanent" | "remove") => {
    if (days === "permanent") {
      setPremium.mutate(
        { userId: user.id, isPremium: true, premiumExpiresAt: null },
        {
          onSuccess: () => {
            toast.success(`${user.firstName}'ga doimiy Premium berildi`);
            onClose();
          },
          onError: (err) => toast.error(err.message),
        },
      );
      return;
    }
    if (days === "remove") {
      setPremium.mutate(
        { userId: user.id, isPremium: false, premiumExpiresAt: null },
        {
          onSuccess: () => {
            toast.info(`${user.firstName}'dan Premium olindi`);
            onClose();
          },
          onError: (err) => toast.error(err.message),
        },
      );
      return;
    }
    const now = Date.now();
    const base = user.premiumExpiresAt && user.premiumExpiresAt > now
      ? user.premiumExpiresAt
      : now;
    const newExp = base + days * 24 * 60 * 60 * 1000;
    setPremium.mutate(
      { userId: user.id, isPremium: false, premiumExpiresAt: newExp },
      {
        onSuccess: () => {
          toast.success(`${user.firstName}'ga ${days} kun Premium qo'shildi`);
          onClose();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[12px] text-tertiary tabular">{user.phone}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="text-tertiary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="rounded-xl bg-elevated p-3 text-[12px]">
          <p className="text-tertiary">Hozirgi holat:</p>
          <p className="text-foreground mt-1">
            {user.isPremium
              ? "✓ Doimiy Premium"
              : user.premiumExpiresAt && user.premiumExpiresAt > Date.now()
                ? `✓ Sovg'a (${Math.ceil((user.premiumExpiresAt - Date.now()) / 86400000)} kun qoldi)`
                : "Bepul"}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-tertiary">
            Sovg'a kun qo'shish
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                disabled={setPremium.isPending}
                onClick={() => grant(d)}
                className="py-2 rounded-lg bg-primary/10 text-primary text-[13px] font-semibold hover:bg-primary/20 disabled:opacity-50 transition"
              >
                +{d} kun
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={setPremium.isPending}
          onClick={() => grant("permanent")}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold disabled:opacity-50 transition"
        >
          Doimiy Premium berish
        </button>

        <button
          type="button"
          disabled={setPremium.isPending}
          onClick={() => grant("remove")}
          className="w-full py-2.5 rounded-lg border border-destructive/40 text-destructive text-[13px] hover:bg-destructive/10 disabled:opacity-50 transition"
        >
          Premium'ni olib tashlash
        </button>
      </div>
    </div>
  );
}
