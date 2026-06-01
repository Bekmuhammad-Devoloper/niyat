import { useQuery } from "@tanstack/react-query";
import { findNearbyMosques, type Mosque } from "@/lib/api/overpass";
import { useSettings } from "./use-settings";

// Foydalanuvchining settings.location'iga asoslangan eng yaqin masjidlar
export function useNearestMosques() {
  const { settings } = useSettings();
  const loc = settings.location;

  const query = useQuery<Mosque[]>({
    enabled: !!loc,
    queryKey: [
      "mosques",
      loc?.latitude.toFixed(3),
      loc?.longitude.toFixed(3),
    ],
    queryFn: async ({ signal }) => {
      if (!loc) return [];
      return findNearbyMosques(loc.latitude, loc.longitude, 5000, signal);
    },
    staleTime: 1000 * 60 * 60 * 24, // 1 kun cache
    gcTime: 1000 * 60 * 60 * 24 * 7,
    retry: 1,
  });

  const nearest = query.data?.[0] ?? null;

  return {
    ...query,
    mosques: query.data ?? [],
    nearest,
  };
}
