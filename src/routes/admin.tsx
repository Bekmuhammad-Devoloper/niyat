import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin · Niyat" }],
  }),
  component: AdminGate,
});

function AdminGate() {
  const { isAuthenticated } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // /admin/login — auth gate'dan tashqari (chunki shu yerda kirayapti)
  const isLoginPage = location.pathname === "/admin/login";

  useEffect(() => {
    if (!isAuthenticated && !isLoginPage) {
      navigate({ to: "/admin/login" });
    }
  }, [isAuthenticated, isLoginPage, navigate]);

  // Login sahifasi — AdminLayout'siz, to'g'ridan-to'g'ri render
  if (isLoginPage) {
    return <Outlet />;
  }

  // Auth yo'q va boshqa sahifada — yo'naltirish davom etmoqda
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-[13px] text-tertiary">Yo'naltirilmoqda...</p>
      </div>
    );
  }

  return (
    <AdminLayout>
      <Outlet />
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{ className: "!bg-card !text-foreground !border-border" }}
      />
    </AdminLayout>
  );
}
