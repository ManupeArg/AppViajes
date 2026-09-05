import type { PlaceCategory, PlaceOverview } from "./types";

export type SortKey = "rating" | "price" | "newest" | "visits" | "name";

export interface Filters {
  q: string;
  country: string;
  city: string;
  category: PlaceCategory | "";
  minRating: number;       // 0 = sin filtro
  maxPrice: number;        // 0 = sin filtro, 1..4
  user: string;            // id de quien lo agregó
  trip: string;            // id de viaje
  onlyWishlist: boolean;   // solo mi "quiero ir"
  onlyVisited: boolean;    // solo donde fui
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  q: "", country: "", city: "", category: "", minRating: 0, maxPrice: 0,
  user: "", trip: "", onlyWishlist: false, onlyVisited: false, sort: "newest",
};

export function filtersFromParams(sp: URLSearchParams): Filters {
  return {
    q: sp.get("q") ?? "",
    country: sp.get("country") ?? "",
    city: sp.get("city") ?? "",
    category: (sp.get("cat") as PlaceCategory) ?? "",
    minRating: Number(sp.get("rating") ?? 0),
    maxPrice: Number(sp.get("price") ?? 0),
    user: sp.get("user") ?? "",
    trip: sp.get("trip") ?? "",
    onlyWishlist: sp.get("wish") === "1",
    onlyVisited: sp.get("visited") === "1",
    sort: (sp.get("sort") as SortKey) ?? "newest",
  };
}

export function filtersToParams(f: Filters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.country) sp.set("country", f.country);
  if (f.city) sp.set("city", f.city);
  if (f.category) sp.set("cat", f.category);
  if (f.minRating) sp.set("rating", String(f.minRating));
  if (f.maxPrice) sp.set("price", String(f.maxPrice));
  if (f.user) sp.set("user", f.user);
  if (f.trip) sp.set("trip", f.trip);
  if (f.onlyWishlist) sp.set("wish", "1");
  if (f.onlyVisited) sp.set("visited", "1");
  if (f.sort !== "newest") sp.set("sort", f.sort);
  return sp;
}

export function applyFilters(places: PlaceOverview[], f: Filters, me: string): PlaceOverview[] {
  const q = f.q.trim().toLowerCase();
  let out = places.filter((p) => {
    if (q && !`${p.name} ${p.city ?? ""} ${p.country ?? ""} ${p.notes ?? ""} ${p.tags.join(" ")}`.toLowerCase().includes(q)) return false;
    if (f.country && p.country !== f.country) return false;
    if (f.city && p.city !== f.city) return false;
    if (f.category && !p.categories.includes(f.category)) return false;
    if (f.minRating && (p.avg_rating ?? 0) < f.minRating) return false;
    if (f.maxPrice && (p.price_level ?? 0) > f.maxPrice) return false;
    if (f.user && p.created_by !== f.user) return false;
    if (f.trip && !p.trip_ids.includes(f.trip)) return false;
    if (f.onlyWishlist && !p.wishlist_ids.includes(me)) return false;
    if (f.onlyVisited && !p.visitor_ids.includes(me)) return false;
    return true;
  });

  const cmp: Record<SortKey, (a: PlaceOverview, b: PlaceOverview) => number> = {
    rating: (a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1),
    price: (a, b) => (a.price_level ?? 99) - (b.price_level ?? 99),
    newest: (a, b) => b.created_at.localeCompare(a.created_at),
    visits: (a, b) => b.visitors_count - a.visitors_count,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  out = [...out].sort(cmp[f.sort]);
  return out;
}

export function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
}
