import { useQuery } from "@tanstack/react-query";
import {
  fetchAllChapters,
  fetchReciters,
  fetchSurahAudio,
  fetchSurahVerses,
  DEFAULT_RECITER_ID,
  UZ_TRANSLATION_ID,
} from "@/lib/api/quran";

// 114 surah ro'yxati — birinchi yuklashda fetch qilinadi, keyin 7 kun cache.
export function useQuranChapters() {
  return useQuery({
    queryKey: ["quran", "chapters"],
    queryFn: ({ signal }) => fetchAllChapters(signal),
    staleTime: 1000 * 60 * 60 * 24 * 7, // 1 hafta
    gcTime: 1000 * 60 * 60 * 24 * 30,
    retry: 1,
  });
}

// Mavjud qorilar ro'yxati
export function useReciters() {
  return useQuery({
    queryKey: ["quran", "reciters"],
    queryFn: ({ signal }) => fetchReciters(signal),
    staleTime: 1000 * 60 * 60 * 24 * 7,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    retry: 1,
  });
}

// Surah ma'lumotlari: oyatlar (arabcha + o'zbekcha) + tilovat audio URL.
// Ikkala so'rov parallel ishlaydi va TanStack Query 24 soatga cache qiladi.
export function useQuranSurah(
  surahNumber: number | null,
  options: { reciterId?: number; translationId?: number } = {},
) {
  const reciterId = options.reciterId ?? DEFAULT_RECITER_ID;
  const translationId = options.translationId ?? UZ_TRANSLATION_ID;

  const versesQuery = useQuery({
    queryKey: ["quran", "verses", surahNumber, translationId],
    queryFn: ({ signal }) => fetchSurahVerses(surahNumber!, translationId, signal),
    enabled: surahNumber !== null,
    staleTime: 1000 * 60 * 60 * 24, // 1 kun
    gcTime: 1000 * 60 * 60 * 24 * 7,
    retry: 1,
  });

  const audioQuery = useQuery({
    queryKey: ["quran", "audio", surahNumber, reciterId],
    queryFn: ({ signal }) => fetchSurahAudio(surahNumber!, reciterId, signal),
    enabled: surahNumber !== null,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24 * 7,
    retry: 1,
  });

  return {
    verses: versesQuery.data ?? [],
    audio: audioQuery.data ?? null,
    isLoading: versesQuery.isLoading || audioQuery.isLoading,
    isError: versesQuery.isError, // audio xato bo'lishi sekundary
    error: versesQuery.error,
  };
}
