// Tipos de la base. Cuando tengas el proyecto en Supabase, regenerá esto con:
//   npx supabase gen types typescript --project-id <id> > src/lib/types.ts
// y borrá las definiciones manuales de abajo (mantené los helpers del final).

// Las categorías son texto libre. Las predefinidas (comida, bebida, …) tienen
// emoji fijo en CATEGORIES; las que crea el grupo viven en custom_categories.
export type PlaceCategory = string;

export type CustomCategory = { name: string; emoji: string | null; created_by: string | null; created_at: string };

export type ActivityKind = "place_added" | "visit" | "wishlist" | "comment" | "photo" | "trip_created" | "trip_place_added";

type Timestamps = { created_at: string };

export type Profile = Timestamps & {
  id: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
  is_admin: boolean;
}

export type Trip = Timestamps & {
  id: string;
  name: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  emoji: string | null;
  is_public: boolean;
  created_by: string;
}

export type TripOverview = Trip & {
  member_ids: string[];
  places_count: number;
};

export type TripMember = { trip_id: string; user_id: string; added_by: string | null; added_at: string };

export type Place = Timestamps & {
  id: string;
  name: string;
  categories: PlaceCategory[];
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  region: string | null;   // provincia / estado / región (nivel 1 del país)
  country: string | null;
  country_code: string | null;
  price_level: number | null;
  google_place_id: string | null;
  website: string | null;
  notes: string | null;
  tags: string[];
  created_by: string;
  updated_at: string;
}

export type PlaceOverview = Place & {
  created_by_name: string;
  created_by_color: string;
  avg_rating: number | null;
  visitors_count: number;
  visitor_ids: string[];
  wishlist_ids: string[];
  photos_count: number;
  trip_ids: string[];
}

export type Visit = Timestamps & {
  id: string;
  place_id: string;
  user_id: string;
  visited_on: string;
  rating: number | null;
  review: string | null;
  price_paid: number | null;
  currency: string | null;
  updated_at: string;
}

export type Wishlist = Timestamps & {
  place_id: string;
  user_id: string;
  note: string | null;
}

export type Photo = Timestamps & {
  id: string;
  place_id: string;
  visit_id: string | null;
  user_id: string;
  storage_path: string;
  caption: string | null;
}

export type Comment = Timestamps & {
  id: string;
  visit_id: string;
  user_id: string;
  body: string;
}

export type Reaction = Timestamps & {
  visit_id: string;
  user_id: string;
  emoji: string;
}

export type Activity = Timestamps & {
  id: number;
  kind: ActivityKind;
  user_id: string;
  place_id: string | null;
  visit_id: string | null;
  comment_id: string | null;
  photo_id: string | null;
  trip_id: string | null;
}

export type TripPlace = { trip_id: string; place_id: string; added_by: string; added_at: string };

export type Invite = Timestamps & {
  code: string;
  created_by: string | null;
  max_uses: number;
  uses: number;
  expires_at: string | null;
}

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Forma mínima que supabase-js necesita para tipar .from()
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Optional<Profile, "created_at" | "avatar_url" | "color" | "is_admin">; Update: Partial<Profile>; Relationships: [] };
      trips: { Row: Trip; Insert: Optional<Trip, "id" | "created_at" | "description" | "starts_on" | "ends_on" | "emoji" | "is_public">; Update: Partial<Trip>; Relationships: [] };
      trip_members: { Row: TripMember; Insert: Optional<TripMember, "added_by" | "added_at">; Update: Partial<TripMember>; Relationships: [] };
      places: { Row: Place; Insert: Optional<Place, "id" | "created_at" | "updated_at" | "address" | "city" | "region" | "country" | "country_code" | "price_level" | "google_place_id" | "website" | "notes" | "tags">; Update: Partial<Place>; Relationships: [] };
      trip_places: { Row: TripPlace; Insert: Optional<TripPlace, "added_at">; Update: Partial<TripPlace>; Relationships: [] };
      visits: { Row: Visit; Insert: Optional<Visit, "id" | "created_at" | "updated_at" | "visited_on" | "rating" | "review" | "price_paid" | "currency">; Update: Partial<Visit>; Relationships: [] };
      wishlist: { Row: Wishlist; Insert: Optional<Wishlist, "created_at" | "note">; Update: Partial<Wishlist>; Relationships: [] };
      photos: { Row: Photo; Insert: Optional<Photo, "id" | "created_at" | "visit_id" | "caption">; Update: Partial<Photo>; Relationships: [] };
      comments: { Row: Comment; Insert: Optional<Comment, "id" | "created_at">; Update: Partial<Comment>; Relationships: [] };
      reactions: { Row: Reaction; Insert: Optional<Reaction, "created_at">; Update: Partial<Reaction>; Relationships: [] };
      activity: { Row: Activity; Insert: Partial<Activity>; Update: Partial<Activity>; Relationships: [] };
      invites: { Row: Invite; Insert: Optional<Invite, "code" | "created_at" | "uses" | "max_uses" | "expires_at">; Update: Partial<Invite>; Relationships: [] };
      custom_categories: { Row: CustomCategory; Insert: Optional<CustomCategory, "emoji" | "created_by" | "created_at">; Update: Partial<CustomCategory>; Relationships: [] };
    };
    Views: {
      places_overview: { Row: PlaceOverview; Relationships: [] };
      trips_overview: { Row: TripOverview; Relationships: [] };
    };
    Functions: {
      check_invite: { Args: { p_code: string }; Returns: boolean };
      is_member: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      redeem_invite: { Args: { p_code?: string | null }; Returns: Profile };
      can_see_trip: { Args: { p_trip: string }; Returns: boolean };
      can_see_place: { Args: { p_place: string }; Returns: boolean };
      adopt_existing_place: { Args: { p_google_place_id: string }; Returns: string | null };
    };
    Enums: {
      activity_kind: ActivityKind;
    };
    CompositeTypes: Record<string, never>;
  };
};

// ---------------------------------------------------------------------------
// Helpers de presentación
// ---------------------------------------------------------------------------
export const CATEGORIES: Record<string, { label: string; emoji: string; color: string }> = {
  comida: { label: "Comida", emoji: "🍽️", color: "#ef4444" },
  bebida: { label: "Bebida", emoji: "🍺", color: "#f59e0b" },
  cafe: { label: "Café", emoji: "☕", color: "#a16207" },
  super: { label: "Súper", emoji: "🛒", color: "#22c55e" },
  compras: { label: "Compras", emoji: "🛍️", color: "#ec4899" },
  alojamiento: { label: "Alojamiento", emoji: "🛏️", color: "#8b5cf6" },
  atraccion: { label: "Atracción", emoji: "📸", color: "#3b82f6" },
  naturaleza: { label: "Naturaleza", emoji: "🌲", color: "#16a34a" },
  vida_nocturna: { label: "Noche", emoji: "🪩", color: "#a855f7" },
  transporte: { label: "Transporte", emoji: "🚇", color: "#64748b" },
};

export const PREDEFINED_CATEGORIES = Object.keys(CATEGORIES);
export const DEFAULT_PIN = "📍";

/** Emoji y etiqueta de una categoría, predefinida o del grupo. */
export function categoryInfo(name: string, customs: CustomCategory[] = []): { label: string; emoji: string } {
  const pre = CATEGORIES[name];
  if (pre) return { label: pre.label, emoji: pre.emoji };
  const c = customs.find((x) => x.name === name);
  return { label: name, emoji: c?.emoji || DEFAULT_PIN };
}

/** Emoji del marcador: el de la primera categoría, o un pin si no tiene. */
export function placeEmoji(cats: string[], customs: CustomCategory[] = []): string {
  return cats.length ? categoryInfo(cats[0], customs).emoji : DEFAULT_PIN;
}

export const PRICE_LABELS = ["", "$", "$$", "$$$", "$$$$"];

/** Etiquetas legibles de las categorías de un lugar. */
export function categoryLabels(cats: string[], customs: CustomCategory[] = [], withEmoji = false): string {
  if (!cats.length) return "Sin categoría";
  return cats.map((c) => { const i = categoryInfo(c, customs); return withEmoji ? `${i.emoji} ${i.label}` : i.label; }).join(" · ");
}
