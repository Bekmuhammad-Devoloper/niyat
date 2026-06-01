// OpenStreetMap Overpass API — eng yaqin masjidlarni topish.
// Bepul, API kalit kerak emas. Docs: https://wiki.openstreetmap.org/wiki/Overpass_API

export type Mosque = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

// Haversine masofa (km)
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // yer radiusi (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type OverpassNode = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// Berilgan koordinata atrofidagi (5 km radius) masjidlarni qaytaradi
export async function findNearbyMosques(
  lat: number,
  lon: number,
  radiusMeters: number = 5000,
  signal?: AbortSignal,
): Promise<Mosque[]> {
  const query = `[out:json][timeout:25];
(
  node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${lat},${lon});
  way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${lat},${lon});
  relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${lat},${lon});
);
out center 50;`;

  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        signal,
      });
      if (!res.ok) {
        lastError = new Error(`Overpass ${res.status}`);
        continue;
      }
      const body = (await res.json()) as { elements: OverpassNode[] };
      const mosques: Mosque[] = body.elements
        .map((el) => {
          const mLat = el.lat ?? el.center?.lat;
          const mLon = el.lon ?? el.center?.lon;
          if (mLat === undefined || mLon === undefined) return null;
          const name =
            el.tags?.["name:uz"] ||
            el.tags?.["name:ru"] ||
            el.tags?.["name"] ||
            el.tags?.["alt_name"] ||
            "Masjid (nomsiz)";
          return {
            id: el.id,
            name,
            lat: mLat,
            lon: mLon,
            distanceKm: haversineKm(lat, lon, mLat, mLon),
          };
        })
        .filter((m): m is Mosque => m !== null)
        .sort((a, b) => a.distanceKm - b.distanceKm);
      return mosques;
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError ?? new Error("Overpass failed");
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// Google Maps va Yandex Maps havolasi
export function mapsLink(lat: number, lon: number, name?: string): string {
  const q = name ? encodeURIComponent(name) : `${lat},${lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}&center=${lat},${lon}`;
}
