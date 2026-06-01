import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "uz.yuksalish.niyat",
  appName: "Niyat",
  webDir: "mobile-dist",
  // Android-specific
  android: {
    allowMixedContent: false,
    backgroundColor: "#0E1410",
  },
  ios: {
    backgroundColor: "#0E1410",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0E1410",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0E1410",
      overlaysWebView: false,
    },
    // Orqa fonda har 15 daqiqada joylashuvni serverga yuboradi.
    // Foydalanuvchi ilovani yopib qoyganda ham ishlaydi — Android'ning
    // WorkManager'i orqali rejalashtirilgan vazifa sifatida.
    BackgroundRunner: {
      label: "uz.yuksalish.niyat.location",
      src: "runners/location-heartbeat.js",
      event: "heartbeat",
      repeat: true,
      interval: 15, // daqiqa (Android'da minimum 15)
      autoStart: true,
    },
  },
};

export default config;
