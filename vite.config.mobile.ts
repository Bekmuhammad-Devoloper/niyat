// Mobile (Capacitor APK) uchun static SPA build.
// TanStack Start (SSR)dan ajralgan — toza Vite + React + Tailwind.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "mobile"),
  publicDir: resolve(__dirname, "public"),
  plugins: [react(), tsconfigPaths({ root: __dirname }), tailwindcss()],
  build: {
    outDir: resolve(__dirname, "mobile-dist"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    // Capacitor ichida ekanligini aniqlash uchun
    "import.meta.env.VITE_IS_MOBILE": JSON.stringify(true),
    // Mobil APK Capacitor WebView'da `https://localhost` dan yuklanadi.
    // Backend API esa GCE serverda (`my.niyat.tech`). Aks holda fetch'lar
    // capacitor://localhost'ga ketib /api/stt, /api/tts, /api/coach
    // ishlamaydi.
    "import.meta.env.VITE_API_BASE": JSON.stringify(
      process.env.VITE_API_BASE || "https://my.niyat.tech",
    ),
  },
});
