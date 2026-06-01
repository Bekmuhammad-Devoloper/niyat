// Mobile bootstrap — Capacitor APK uchun.
// TanStack Start (SSR) o'rniga to'g'ridan-to'g'ri NiyatApp'ni mount qiladi.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NiyatApp } from "@/components/niyat/NiyatApp";
import "../src/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <NiyatApp />
    </QueryClientProvider>
  </StrictMode>,
);
