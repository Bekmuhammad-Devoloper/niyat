// Mobile bootstrap — Capacitor APK uchun.
// TanStack Start (SSR) o'rniga to'g'ridan-to'g'ri NiyatApp'ni mount qiladi.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NiyatApp } from "@/components/niyat/NiyatApp";
import { AppErrorBoundary } from "@/components/niyat/AppErrorBoundary";
import "../src/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Brauzer'ning umumiy xato hodisalarini ham ushlaymiz — Promise rejection'lar
// va boshqa unhandled errorlar ilovani crash qilmasin.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    console.warn("[unhandledrejection] (yumshoq):", e.reason);
    e.preventDefault();
  });
  window.addEventListener("error", (e) => {
    console.warn("[window.error] (yumshoq):", e.message);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NiyatApp />
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
