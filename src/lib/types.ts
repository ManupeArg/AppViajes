// Tipos de la base. Cuando tengas el proyecto en Supabase, regenerá esto con:
//   npx supabase gen types typescript --project-id <id> > src/lib/types.ts
// y borrá las definiciones manuales de abajo (mantené los helpers del final).

export type PlaceCategory =
  | "comida"
  | "bebida"
  | "cafe"
  | "super"
  | "compras"
  | "alojamiento"
  | "atraccion"
  | "naturaleza"
  | "vida_nocturna"
  | "transporte"
  | "otro";

export type ActivityKind = "place_added" | "visit" | "wishlist" | "comment" | "photo";

type Timestamps = { created_at: string };

export type Profile = Timestamps & {
  id: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
}

export type Trip = Timestamps & {
  id: string;
  name: string;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  emoji: string | null;
  created_by: string;
}

export type Place = Timestamps & {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
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
      profiles: { Row: Profile; Insert: Optional<Profile, "created_at" | "avatar_url" | "color">; Update: Partial<Profile>; Relationships: [] };
      trips: { Row: Trip; Insert: Optional<Trip, "id" | "created_at" | "description" | "starts_on" | "ends_on" | "emoji">; Update: Partial<Trip>; Relationships: [] };
      places: { Row: Place; Insert: Optional<Place, "id" | "created_at" | "updated_at" | "address" | "city" | "country" | "country_code" | "price_level" | "google_place_id" | "website" | "notes" | "tags">; Update: Partial<Place>; Relationships: [] };
      trip_places: { Row: TripPlace; Insert: Optional<TripPlace, "added_at">; Update: Partial<TripPlace>; Relationships: [] };
      visits: { Row: Visit; Insert: Optional<Visit, "id" | "created_at" | "updated_at" | "visited_on" | "rating" | "review" | "price_paid" | "currency">; Update: Partial<Visit>; Relationships: [] };
      wishlist: { Row: Wishlist; Insert: Optional<Wishlist, "created_at" | "note">; Update: Partial<Wishlist>; Relationships: [] };
      photos: { Row: Photo; Insert: Optional<Photo, "id" | "created_at" | "visit_id" | "caption">; Update: Partial<Photo>; Relationships: [] };
      comments: { Row: Comment; Insert: Optional<Comment, "id" | "created_at">; Update: Partial<Comment>; Relationships: [] };
      reactions: { Row: Reaction; Insert: Optional<Reaction, "created_at">; Update: Partial<Reaction>; Relationships: [] };
      activity: { Row: Activity; Insert: Partial<Activity>; Update: Partial<Activity>; Relationships: [] };
      invites: { Row: Invite; Insert: Optional<Invite, "code" | "created_at" | "uses" | "max_uses" | "expires_at">; Update: Partial<Invite>; Relationships: [] };
    };
    Views: {
      places_overview: { Row: PlaceOverview; Relationships: [] };
    };
    Functions: {
      check_invite: { Args: { p_code: string }; Returns: boolean };
      is_member: { Args: Record<string, never>; Returns: boolean };
      redeem_invite: { Args: { p_code?: string | null }; Returns: Profile };
    };
    Enums: {
      place_category: PlaceCategory;
      activity_kind: ActivityKind;
    };
    CompositeTypes: Record<string, never>;
  };
};

// ---------------------------------------------------------------------------
// Helpers de presentación
// ---------------------------------------------------------------------------
export const CATEGORIES: Record<PlaceCategory, { label: string; emoji: string; color: string }> = {
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
  otro: { label: "Otro", emoji: "📍", color: "#6b7280" },
};

export const PRICE_LABELS = ["", "$", "$$", "$$$", "$$$$"];
