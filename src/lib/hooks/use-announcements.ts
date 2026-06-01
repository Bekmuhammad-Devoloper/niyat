// Foydalanuvchi ilovasi tomonidan admin e'lonlarini olish va o'qilganini
// localStorage'da saqlash.

import { useQuery } from "@tanstack/react-query";
import { useLocalState } from "@/lib/use-local-state";

export type PublicAnnouncement = {
  id: string;
  title: string;
  body: string;
  priority: "normal" | "important" | "critical";
  createdAt: number;
  expiresAt: number | null;
};

const READ_KEY = "niyat:announcements:read";

async function fetchAnnouncements(signal?: AbortSignal): Promise<PublicAnnouncement[]> {
  const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
  const res = await fetch(`${apiBase}/api/announcements`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { announcements: PublicAnnouncement[] };
  return data.announcements;
}

export function useAnnouncementsPublic() {
  const query = useQuery({
    queryKey: ["public", "announcements"],
    queryFn: ({ signal }) => fetchAnnouncements(signal),
    staleTime: 1000 * 60 * 5, // 5 daqiqa
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });

  const [readIds, setReadIds] = useLocalState<string[]>(READ_KEY, []);
  const readSet = new Set(readIds);

  const announcements = query.data ?? [];
  const unread = announcements.filter((a) => !readSet.has(a.id));

  const markRead = (id: string) => {
    if (readSet.has(id)) return;
    setReadIds([...readIds, id]);
  };

  const markAllRead = () => {
    const allIds = announcements.map((a) => a.id);
    setReadIds([...new Set([...readIds, ...allIds])]);
  };

  return {
    ...query,
    announcements,
    unread,
    markRead,
    markAllRead,
  };
}
