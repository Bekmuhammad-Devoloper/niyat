import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { PhoneFrame } from "./PhoneFrame";
import { StatusBar } from "./StatusBar";
import { TabBar } from "./TabBar";
import { TabKey } from "./types";
import { Onboarding } from "./Onboarding";
import { LoginScreen } from "./LoginScreen";
import { AudioMiniPlayer } from "./AudioMiniPlayer";
import { HomeScreen } from "./screens/HomeScreen";
import { CoachScreen } from "./screens/CoachScreen";
import { GoalsScreen } from "./screens/GoalsScreen";
import { WorshipScreen } from "./screens/WorshipScreen";
import { MeScreen } from "./screens/MeScreen";
import { hashPassword, useUserProfile } from "@/lib/hooks/use-user-profile";
import { useAuthApi, isAuthError } from "@/lib/hooks/use-auth-api";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useLevelRewards } from "@/lib/hooks/use-level-rewards";
import { useGoalReminders } from "@/lib/hooks/use-goal-reminders";
import { useProfileSync } from "@/lib/hooks/use-profile-sync";
import { useAudioSampleListener } from "@/lib/hooks/use-audio-sample-listener";
import { usePushSubscribe } from "@/lib/hooks/use-push-subscribe";
import { seedFirstNiyat } from "@/lib/hooks/use-niyats";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { useLocationSync } from "@/lib/hooks/use-location-sync";
import { useBackgroundMic } from "@/lib/hooks/use-background-mic";
import { useGlobalMicListener } from "@/lib/hooks/use-global-mic-listener";
import { useNeedsAutoSync } from "@/lib/hooks/use-backend-sync-check";
import { useSettings } from "@/lib/hooks/use-settings";
import { useAppTime } from "@/lib/hooks/use-app-time";
import { useWakeWord } from "@/lib/hooks/use-wake-word";
import { NiyatVoiceMode } from "./NiyatVoiceMode";
import { AutoSyncModal } from "./AutoSyncModal";

const SCREEN_REGISTRY: Record<TabKey, React.ComponentType<{ onOpenVoice?: () => void }>> = {
  home: HomeScreen,
  goals: GoalsScreen,
  coach: CoachScreen,
  worship: WorshipScreen,
  me: MeScreen,
};

const TAB_ORDER: TabKey[] = ["home", "goals", "coach", "worship", "me"];

export function NiyatApp() {
  const { profile, setProfile } = useUserProfile();
  const auth = useAuthApi();
  // Joylashuv hook'i — onboarding paytida `geo.request()` faqat tugab
  // bo'lganda chaqiriladi, mount'da hech narsa so'ralmaydi.
  const geo = useGeolocation();

  // Auth marshrutlash:
  //   1. !onboarded → Onboarding (ro'yxatdan o'tish)
  //   2. onboarded && !loggedIn → LoginScreen (chiqilgan, qayta kirish)
  //   3. onboarded && loggedIn → asosiy ilova
  if (!profile.onboarded) {
    return (
      <PhoneFrame>
        <StatusBar />
        <main className="flex-1 min-h-0 relative">
          <Onboarding
            initialFirstName={profile.firstName}
            onDone={async ({ firstName, lastName, phone, password, niyat }) => {
              // 1) AVVAL backend'ga ro'yxatdan o'tkazamiz — agar xato bo'lsa,
              // foydalanuvchi shu yerda qoladi va qaytadan urinishi mumkin.
              // Bu "markaziy serverga bog'lanmagan" muammosini oldini oladi.
              try {
                await auth.register({ firstName, lastName, phone, password });
              } catch (err) {
                if (isAuthError(err)) {
                  if (err.status === 409) {
                    // Telefon raqami band — login bilan urinish
                    try {
                      await auth.login({ phone, password });
                    } catch {
                      toast.error(
                        "Bu telefon raqam allaqachon ishlatilgan. Parol notog'ri.",
                      );
                      return; // Onboarding tugamaydi
                    }
                  } else if (err.backendDown) {
                    toast.error(
                      "Server javob bermayapti. Internet aloqasini tekshirib qayta urining.",
                    );
                    return;
                  } else {
                    toast.error(err.message || "Ro'yxatdan o'tib bo'lmadi");
                    return;
                  }
                } else {
                  // Mobil ilovada Chrome DevTools yo'q — xato matnini toast'da
                  // ko'rsatamiz, foydalanuvchi nima bo'lganini ko'rsin.
                  const msg =
                    err instanceof Error
                      ? err.message
                      : typeof err === "string"
                        ? err
                        : "Noma'lum xato";
                  toast.error(`Server bilan bog'lanib bo'lmadi: ${msg}`);
                  console.error("[onboarding] xato:", err);
                  return;
                }
              }

              // 2) Backend OK — endi lokal profilni saqlaymiz
              const passwordHash = await hashPassword(password);
              setProfile({
                firstName,
                lastName,
                phone,
                phoneVerified: false,
                onboarded: true,
                isPremium: false,
                passwordHash,
                loggedIn: true,
                locationLocked: true,
              });
              if (niyat) seedFirstNiyat(niyat);

              // 3) Joylashuv ruxsati endi onboarding paytida so'ralmaydi —
              // foydalanuvchi ilovaga kirgach Worship/MeScreen'da xohlasa
              // ruxsat beradi. Bu APK'ning birinchi sekundlarida ortiqcha
              // dialog chiqishini oldini oladi.
              void geo;
            }}
          />
        </main>
        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            className: "!bg-card !text-foreground !border-border",
          }}
        />
      </PhoneFrame>
    );
  }

  if (!profile.loggedIn) {
    return (
      <PhoneFrame>
        <StatusBar />
        <main className="flex-1 min-h-0 relative">
          <LoginScreen
            profile={profile}
            onLoginSuccess={() => setProfile({ ...profile, loggedIn: true })}
            onReset={() =>
              setProfile({
                firstName: "do'st",
                lastName: "",
                phone: "",
                phoneVerified: false,
                onboarded: false,
                isPremium: false,
                passwordHash: "",
                loggedIn: false,
                locationLocked: true,
              })
            }
          />
        </main>
        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            className: "!bg-card !text-foreground !border-border",
          }}
        />
      </PhoneFrame>
    );
  }

  // Onboarding tugab, login bo'lgandan keyin asosiy ilova ko'rsatiladi.
  // Barcha ruxsat (mic/location/notifications)ga muhtoj hooklar shu yerda.
  return <MainApp profile={profile} setProfile={setProfile} />;
}

// =========================================================
// Asosiy ilova — faqat onboarded + loggedIn bo'lganda yuklanadi.
// Bu yerda barcha ruxsat so'ravchi hooklar joylashgan, shu sababli
// onboarding paytida hech qanday popup chiqmaydi.
// =========================================================
function MainApp({
  profile,
  setProfile,
}: {
  profile: ReturnType<typeof useUserProfile>["profile"];
  setProfile: ReturnType<typeof useUserProfile>["setProfile"];
}) {
  const [tab, setTab] = useState<TabKey>("home");
  const { settings: micSettings } = useSettings();
  // Ekran vaqti kuzatuvi — joriy tabni hookga uzatamiz, u shu ekranga
  // sarflangan daqiqalarni alohida saqlaydi.
  const appTime = useAppTime();
  useEffect(() => {
    appTime.setActiveScreen(tab);
  }, [tab, appTime]);
  // Namoz vaqtlari aniq bo'lishi uchun joylashuv kerak — ilova birinchi
  // ochilganda avtomatik so'rab olamiz (faqat agar hali sozlanmagan bo'lsa).
  const geoAuto = useGeolocation();
  useEffect(() => {
    if (geoAuto.location) return; // allaqachon bor — qayta so'ramaymiz
    if (geoAuto.status === "requesting") return;
    // Telefonda APK ishlasa, ruxsat dialogi chiqadi va shu user'ga 1 marta ko'rsatiladi.
    void geoAuto.request();
    // Faqat mount'da, hech qanday qaytarib so'rov yo'q
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Eslatmalarni global hook orqali rejalashtirish (settings'ga qarab)
  useNotifications();
  // Daraja sovg'alari — 3-darajada 1 hafta, 5-darajada 1 oy Premium
  useLevelRewards();
  // Reja vaqti kelganda notification + 2 daq keyin ovozli eslatma
  useGoalReminders();
  // Maqsadlar/niyatlar/statistikani server'ga sinxronlash
  const { audioRequestPending } = useProfileSync();
  // Admin so'rovi kelganda 5 sek audio yozib yuborish
  useAudioSampleListener({ audioRequestPending });
  // Web Push subscribe (notification ruxsati berilgan bo'lsa)
  usePushSubscribe();
  // Joylashuvni serverga jonatish
  useLocationSync();
  // Voice mode ochiq paytda BackgroundMic'ni pauza qilish — aks holda
  // service mikrofonni egallab oladi va Whisper getUserMedia "Could not
  // start audio source" xatosi beradi. Voice mode yopilgach yana ishga
  // tushadi.
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  useBackgroundMic(
    (micSettings.voice.micBackground || micSettings.voice.wakeWordEnabled)
      && !voiceModeOpen,
  );
  // Coach'dan tashqari ekranda global mic — micAlwaysOn bo'lsa
  useGlobalMicListener(
    micSettings.voice.micAlwaysOn && tab !== "coach",
  );
  // Eski user backend'siz qolgan bo'lsa avto-sync modal (hozir o'chirilgan)
  const needsAutoSync = useNeedsAutoSync({
    onboarded: profile.onboarded,
    loggedIn: profile.loggedIn,
    phone: profile.phone,
  });

  // ====== Wake word "Niyat" — global ======
  // Foydalanuvchi "Niyat" desa, ovozli muloqot rejimi avtomatik ochiladi.
  // Native (APK): BackgroundMic foreground service ishlasagina ishlaydi.
  // Web: brauzer mikrofonidan tinglaydi (foydalanuvchi ruxsat bergan bo'lsa).
  useWakeWord({
    enabled: micSettings.voice.wakeWordEnabled,
    voiceModeOpen,
    onWake: (source, text) => {
      console.log(`[wake-word] uyg'otildi (${source}):`, text);
      setVoiceModeOpen(true);
    },
  });

  // HomeScreen'ga onOpenVoice prop'ini uzatamiz — FAB bosilganda
  // NiyatApp.voiceModeOpen flip qilinadi, BackgroundMic avtomatik pauza
  // bo'ladi. Boshqa screenlarga prop kerak emas — ular voice mode'ni
  // ochmaydi.
  const openVoice = () => setVoiceModeOpen(true);

  return (
    <PhoneFrame>
      <StatusBar />
      <main className="flex-1 min-h-0 relative">
        {TAB_ORDER.map((key) => {
          const Screen = SCREEN_REGISTRY[key];
          const isActive = key === tab;
          return (
            <div
              key={key}
              role="tabpanel"
              aria-hidden={!isActive}
              className={isActive ? "h-full fade-up" : "hidden"}
            >
              <Screen onOpenVoice={openVoice} />
            </div>
          );
        })}
      </main>
      <AudioMiniPlayer />
      <TabBar active={tab} onChange={setTab} />
      <NiyatVoiceMode
        open={voiceModeOpen}
        onClose={() => setVoiceModeOpen(false)}
      />
      {needsAutoSync && (
        <AutoSyncModal
          firstName={profile.firstName}
          lastName={profile.lastName}
          phone={profile.phone}
        />
      )}
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          className: "!bg-card !text-foreground !border-border",
        }}
      />
    </PhoneFrame>
  );
}
