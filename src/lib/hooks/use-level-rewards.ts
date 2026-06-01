import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useUserProfile } from "./use-user-profile";
import { useStats } from "./use-stats";

// Daraja sovg'alari — maxsus darajalar uchun Premium kunlari.
// Foydalanuvchi bu darajaga birinchi marta yetganida sovg'a beriladi.
type LevelReward = {
  level: number;
  days: number;
  title: string;
  description: string;
};

const REWARDS: LevelReward[] = [
  {
    level: 3,
    days: 7,
    title: "🎉 3-daraja yutuq!",
    description: "1 hafta Premium sovg'a — TTS va ko'p AI shaxsiyatlar yoqildi",
  },
  {
    level: 5,
    days: 30,
    title: "🏆 5-daraja yutuq!",
    description: "1 oy Premium sovg'a — barcha Premium funksiyalar 30 kun",
  },
];

// Foydalanuvchi qancha daraja yutuqlarini ola olganini kuzatadi va
// chegara o'tilganda Premium kunlar qo'shadi.
export function useLevelRewards() {
  const { profile, setProfile } = useUserProfile();
  const stats = useStats();
  // Bir render davomida ko'p marta grant bo'lib qolmasligi uchun
  const grantingRef = useRef(false);

  useEffect(() => {
    if (grantingRef.current) return;
    const currentLevel = Math.floor(stats.level * 10) / 10; // 2.3, 3.0, 4.7 va h.k.
    const claimed = new Set(profile.claimedLevelRewards ?? []);

    // Tartibda — past darajadan boshlab
    const eligible = REWARDS.filter(
      (r) => currentLevel >= r.level && !claimed.has(r.level),
    );
    if (eligible.length === 0) return;

    grantingRef.current = true;
    const now = Date.now();
    // Mavjud sovg'a premium oxirini saqlash — yangi kunlarni ustiga qo'shamiz
    let baseExp = Math.max(now, profile.premiumExpiresAt ?? 0);
    const newClaimed = [...(profile.claimedLevelRewards ?? [])];
    for (const r of eligible) {
      baseExp += r.days * 24 * 60 * 60 * 1000;
      newClaimed.push(r.level);
      // Toast ko'rsatish — ketma-ket sovg'alar uchun pauza bilan
      setTimeout(() => {
        toast.success(r.title, {
          description: r.description,
          duration: 8000,
        });
      }, eligible.indexOf(r) * 1200);
    }

    setProfile({
      ...profile,
      premiumExpiresAt: baseExp,
      claimedLevelRewards: newClaimed,
    });
    // Keyingi render'da yana ishlamasligi uchun kichik kutish
    setTimeout(() => {
      grantingRef.current = false;
    }, 100);
  }, [stats.level, profile, setProfile]);
}
