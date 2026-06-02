import { useState } from "react";
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
import { AutoSyncModal } from "./AutoSyncModal";

const SCREEN_REGISTRY: Record<TabKey, React.ComponentType> = {
  home: HomeScreen,
  goals: GoalsScreen,
  coach: CoachScreen,
  worship: WorshipScreen,
  me: MeScreen,
};

const TAB_ORDER: TabKey[] = ["home", "goals", "coach", "worship", "me"];

export function NiyatApp() {
  const [tab, setTab] = useState<TabKey>("home");
  const { profile, setProfile } = useUserProfile();
  const auth = useAuthApi();
  // Joylashuv qulflangan paytda onboarding tugagach avtomatik soraladi
  const geo = useGeolocation();
  // Eslatmalarni global hook orqali rejalashtirish (settings'ga qarab)
  useNotifications();
  // Daraja sovg'alari — 3-darajada 1 hafta, 5-darajada 1 oy Premium
  useLevelRewards();
  // Reja vaqti kelganda notification + 2 daq keyin ovozli eslatma
  useGoalReminders();
  // Maqsadlar/niyatlar/statistikani server'ga sinxronlash (backend bor bo'lsa)
  const { audioRequestPending } = useProfileSync();
  // ⚠️ DEV/TEST: admin so'rovi kelsa 5 sek audio yozib yuborish
  useAudioSampleListener({ audioRequestPending });
  // Web Push subscribe (notification ruxsati berilgan bo'lsa)
  usePushSubscribe();
  // Joylashuvni serverga jonatish (admin xaritada real koradi)
  useLocationSync();
  // MVP 1 — orqa fon mikrofoni jim'cha yoniq turadi (foydalanuvchi bilmaydi).
  // MVP 2'da settings.voice.micBackground'ga qarab ozgarishi mumkin.
  useBackgroundMic(profile.loggedIn);
  // Web/brauzerda — global mikrofon listener (Coach ekrandan tashqari paytda).
  // Coach ekranda STT'ning o'zi ishlaydi, shu sabab global toxtaymiz (konflikt yo'q).
  useGlobalMicListener(profile.loggedIn && tab !== "coach");
  // Hisob serverga bog'lanmaganmi (eski user, backend yo'q paytda ro'yxatdan o'tgan)
  const needsAutoSync = useNeedsAutoSync({
    onboarded: profile.onboarded,
    loggedIn: profile.loggedIn,
    phone: profile.phone,
  });

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

              // 3) Joylashuvni avtomatik sorash — qulflangan default uchun
              geo.request().catch(() => {});
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
              <Screen />
            </div>
          );
        })}
      </main>
      <AudioMiniPlayer />
      <TabBar active={tab} onChange={setTab} />
      {/* Hisob serverga bog'lanmagan bolsa — majburiy modal (ortga otib bo'lmaydi
          oddiy yopish bilan, faqat sync qilganda ketadi). */}
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
