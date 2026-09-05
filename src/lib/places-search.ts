// Búsqueda de lugares con Google Places API (New), vía REST.
// Necesita NEXT_PUBLIC_GOOGLE_MAPS_KEY con "Places API (New)" habilitada y
// la key restringida a tu dominio (HTTP referrers) en Google Cloud Console.
//
// Sin key, cae a Nominatim (OpenStreetMap): gratis pero con datos más pobres.

import type { PlaceCategory } from "./types";

export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  price_level: number | null;
  google_place_id: string | null;
  website: string | null;
  categories: PlaceCategory[];
}

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<PlaceResult[]> {
  if (!query.trim()) return [];
  return GOOGLE_KEY ? searchGoogle(query, near) : searchNominatim(query);
}

// ---------------------------------------------------------------------------
// Google Places (New)
// ---------------------------------------------------------------------------
interface GPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  priceLevel?: string;
  websiteUri?: string;
  types?: string[];
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
}

async function searchGoogle(query: string, near?: { lat: number; lng: number }): Promise<PlaceResult[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY!,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.priceLevel,places.websiteUri,places.types,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "es",
      pageSize: 8,
      ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 50000 } } } : {}),
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`Google Places (${res.status}): ${body.error?.message ?? "revisá que la Places API (New) esté habilitada, la facturación activa y la key permitida para este dominio"}`);
  }
  const json = (await res.json()) as { places?: GPlace[] };

  return (json.places ?? []).map((p) => {
    const comp = (t: string) => p.addressComponents?.find((c) => c.types.includes(t));
    return {
      name: p.displayName?.text ?? query,
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
      address: p.formattedAddress ?? null,
      city: comp("locality")?.longText ?? comp("administrative_area_level_2")?.longText ?? comp("administrative_area_level_1")?.longText ?? null,
      region: comp("administrative_area_level_1")?.longText ?? null,
      country: comp("country")?.longText ?? null,
      country_code: comp("country")?.shortText ?? null,
      price_level: googlePrice(p.priceLevel),
      google_place_id: p.id,
      website: p.websiteUri ?? null,
      categories: [guessCategory(p.types ?? [])].filter((c): c is string => !!c),
    };
  });
}

function googlePrice(level?: string): number | null {
  switch (level) {
    case "PRICE_LEVEL_INEXPENSIVE": return 1;
    case "PRICE_LEVEL_MODERATE": return 2;
    case "PRICE_LEVEL_EXPENSIVE": return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE": return 4;
    default: return null;
  }
}

function guessCategory(types: string[]): PlaceCategory | null {
  const has = (...t: string[]) => t.some((x) => types.includes(x));
  if (has("cafe", "coffee_shop", "bakery")) return "cafe";
  if (has("bar", "pub", "wine_bar", "liquor_store")) return "bebida";
  if (has("night_club")) return "vida_nocturna";
  if (has("restaurant", "food", "meal_takeaway", "ice_cream_shop", "pizza_restaurant")) return "comida";
  if (has("supermarket", "grocery_store", "convenience_store", "market")) return "super";
  if (has("shopping_mall", "store", "clothing_store", "book_store")) return "compras";
  if (has("lodging", "hotel", "hostel")) return "alojamiento";
  if (has("park", "hiking_area", "beach", "natural_feature", "national_park")) return "naturaleza";
  if (has("tourist_attraction", "museum", "art_gallery", "landmark", "historical_landmark")) return "atraccion";
  if (has("train_station", "subway_station", "airport", "bus_station", "transit_station")) return "transporte";
  return null;
}

// ---------------------------------------------------------------------------
// Nominatim (fallback sin key). Respetar el rate limit de 1 req/seg.
// ---------------------------------------------------------------------------
interface NResult {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
  class?: string;
  type?: string;
}

async function searchNominatim(query: string): Promise<PlaceResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=es&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Nominatim: ${res.status}`);
  const json = (await res.json()) as NResult[];
  return json.map((r) => ({
    name: r.name || r.display_name.split(",")[0],
    lat: Number(r.lat),
    lng: Number(r.lon),
    address: r.display_name,
    city: r.address?.city ?? r.address?.town ?? r.address?.village ?? r.address?.municipality ?? null,
    region: r.address?.state ?? r.address?.province ?? null,
    country: r.address?.country ?? null,
    country_code: r.address?.country_code?.toUpperCase() ?? null,
    price_level: null,
    google_place_id: null,
    website: null,
    categories: [guessCategory([r.type ?? "", r.class ?? ""])].filter((c): c is string => !!c),
  }));
}

// ---------------------------------------------------------------------------
// Geocoding inverso: coordenadas -> dirección, ciudad, país.
// Usa MapTiler (gratis con la misma key del mapa) y si no hay key, Nominatim.
// ---------------------------------------------------------------------------
export interface ReverseResult {
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
}

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseResult> {
  try {
    if (MAPTILER_KEY) {
      const res = await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}&language=es&limit=1`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as {
        features?: { place_name?: string; place_type?: string[]; text?: string; properties?: { country_code?: string }; context?: { id: string; text: string; country_code?: string }[] }[];
      };
      const f = json.features?.[0];
      if (!f) return { address: null, city: null, region: null, country: null, country_code: null };
      const ctx = (prefixes: string[]) => f.context?.find((c) => prefixes.some((p) => c.id.startsWith(p)))?.text ?? null;
      const country = f.context?.find((c) => c.id.startsWith("country"));
      return {
        address: f.place_name ?? null,
        city: ctx(["municipality", "locality", "place", "municipal_district", "county"]),
        region: ctx(["region", "subregion"]),
        country: country?.text ?? null,
        country_code: (country?.country_code ?? f.properties?.country_code ?? null)?.toUpperCase() ?? null,
      };
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`);
    if (!res.ok) throw new Error(String(res.status));
    const r = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    return {
      address: r.display_name ?? null,
      city: r.address?.city ?? r.address?.town ?? r.address?.village ?? r.address?.municipality ?? null,
      region: r.address?.state ?? r.address?.province ?? null,
      country: r.address?.country ?? null,
      country_code: r.address?.country_code?.toUpperCase() ?? null,
    };
  } catch {
    return { address: null, city: null, region: null, country: null, country_code: null };
  }
}

/** Categoría a partir de la clase/subclase de un POI de OpenMapTiles (lo que dibuja MapTiler). */
export function categoryFromPoi(cls?: string, subclass?: string): PlaceCategory | null {
  const c = `${cls ?? ""} ${subclass ?? ""}`;
  const has = (...t: string[]) => t.some((x) => c.includes(x));
  if (has("cafe", "coffee", "bakery")) return "cafe";
  if (has("bar", "pub", "biergarten", "alcohol", "wine")) return "bebida";
  if (has("nightclub", "night_club", "casino")) return "vida_nocturna";
  if (has("restaurant", "fast_food", "food", "ice_cream")) return "comida";
  if (has("grocery", "supermarket", "convenience", "marketplace")) return "super";
  if (has("shop", "clothes", "mall", "department", "books")) return "compras";
  if (has("lodging", "hotel", "hostel", "guest")) return "alojamiento";
  if (has("park", "garden", "beach", "nature", "viewpoint", "peak", "water")) return "naturaleza";
  if (has("attraction", "museum", "monument", "art", "theatre", "cinema", "stadium", "zoo", "castle", "landmark", "place_of_worship")) return "atraccion";
  if (has("railway", "bus", "airport", "ferry", "subway", "tram", "station", "taxi")) return "transporte";
  return null;
}
