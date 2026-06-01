import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout: list (/admin/users) yoki detail (/admin/users/$userId) — ikkalasi
// ham shu yerdan Outlet orqali ko'rsatiladi.
export const Route = createFileRoute("/admin/users")({
  component: () => <Outlet />,
});
