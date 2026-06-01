import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  Activity,
  Megaphone,
  Settings,
  LogOut,
  Menu as MenuIcon,
  X,
} from "lucide-react";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Foydalanuvchilar", icon: Users },
  { to: "/admin/announcements", label: "E'lonlar", icon: Megaphone },
  { to: "/admin/content", label: "Kontent", icon: FileText },
  { to: "/admin/ai-logs", label: "AI loglar", icon: Activity },
  { to: "/admin/settings", label: "Sozlamalar", icon: Settings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAdminAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar — desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transition-transform lg:translate-x-0 lg:static ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-border flex items-center justify-between">
          <div>
            <p className="font-serif text-[18px] text-foreground">Niyat Admin</p>
            <p className="text-[10px] text-tertiary uppercase tracking-wider">Yuksalish.dev</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-tertiary hover:text-foreground"
            aria-label="Yopish"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition ${
                  isActive
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-elevated hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 px-3 py-3 border-t border-border">
          <button
            type="button"
            onClick={() => {
              if (confirm("Admin panel'dan chiqasizmi?")) {
                logout();
                window.location.href = "/admin/login";
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-muted-foreground hover:bg-elevated hover:text-destructive transition"
          >
            <LogOut size={16} />
            Chiqish
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Menyu yopish"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-0 ml-0 min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Menyu"
            className="text-foreground"
          >
            <MenuIcon size={20} />
          </button>
          <p className="font-serif text-[15px]">Niyat Admin</p>
          <span className="w-5" />
        </div>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
