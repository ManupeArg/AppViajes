"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Navigation, Share2, Star, Trash2, Plane } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PlaceOverview, Profile, TripOverview, Visit } from "@/lib/types";
import { CATEGORIES, PRICE_LABELS, mainCategory } from "@/lib/types";
import { Avatar, Avatars } from "./avatars";
import { VisitForm } from "./visit-form";

interface Props {
  place: PlaceOverview;
  profiles: Profile[];
  trips: TripOverview[];
  me: string;
  onClose: () => void;
}

export function PlaceSheet({ place, profiles, trips, me, onClose }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [, start] = useTransition();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const cat = CATEGORIES[mainCategory(place.categories)];
  const catLabels = place.categories.map((c) => `${CATEGORIES[c].emoji} ${CATEGORIES[c].label}`).join(" · ") || cat.label;
  const visited = place.visitor_ids.includes(me);
  // "Quiero ir" optimista: el botón cambia al instante; cuando el servidor confirma
  // (y el valor real cambia), el override deja de aplicar solo.
  const serverWished = place.wishlist_ids.includes(me);
  const [wishOverride, setWishOverride] = useState<{ base: boolean; value: boolean } | null>(null);
  const wished = wishOverride && wishOverride.base === serverWished ? wishOverride.value : serverWished;
  const myVisit = visits.find((v) => v.user_id === me);

  useEffect(() => {
    supabase
      .from("visits")
      .select("*")
      .eq("place_id", place.id)
      .order("visited_on", { ascending: false })
      .then(({ data }) => setVisits(data ?? []));
  }, [place.id, supabase]);

  const refresh = () => start(() => router.refresh());

  async function toggleWishlist() {
    const next = !wished;
    setWishOverride({ base: serverWished, value: next });
    setActionError(null);
    const { error } = next
      ? await supabase.from("wishlist").insert({ place_id: place.id, user_id: me })
      : await supabase.from("wishlist").delete().match({ place_id: place.id, user_id: me });
    if (error) {
      setWishOverride(null);
      setActionError(error.message);
      return;
    }
    refresh();
  }

  async function addToTrip(tripId: string) {
    if (!tripId) return;
    setActionError(null);
    const { error } = await supabase.from("trip_places").upsert({ trip_id: tripId, place_id: place.id, added_by: me });
    if (error) setActionError(error.message);
    else refresh();
  }

  async function removeFromTrip(tripId: string) {
    setActionError(null);
    const { error } = await supabase.from("trip_places").delete().match({ trip_id: tripId, place_id: place.id });
    if (error) setActionError(error.message);
    else refresh();
  }

  async function removePlace() {
    if (!window.confirm(`¿Borrar "${place.name}"? Se borran también las visitas de todos.`)) return;
    await supabase.from("places").delete().eq("id", place.id);
    onClose();
    refresh();
  }

  async function share() {
    const url = `${window.location.origin}/p/${place.id}`;
    const data = { title: place.name, text: `${cat.emoji} ${place.name} — ${[place.city, place.country].filter(Boolean).join(", ")}`, url };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      alert("Link copiado");
    }
  }

  const directions = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}${place.google_place_id ? `&destination_place_id=${place.google_place_id}` : ""}`;

  return (
    <aside className="absolute inset-x-0 bottom-0 z-20 max-h-[85%] overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[400px] sm:rounded-none sm:border-l sm:border-t-0 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="sticky top-0 flex items-start gap-3 border-b border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid size-12 shrink-0 place-items-center rounded-full text-2xl" style={{ background: `${place.created_by_color}22`, border: `2px solid ${place.created_by_color}` }}>
          {cat.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight">{place.name}</h2>
          <p className="text-sm text-zinc-500">
            {[place.address ?? place.city, place.country].filter(Boolean).join(", ")}
          </p>
          <p className="text-sm text-zinc-500">
            {catLabels}{place.price_level ? ` · ${PRICE_LABELS[place.price_level]}` : ""}
            {place.avg_rating != null && <> · <b className="text-zinc-900 dark:text-zinc-100">★ {place.avg_rating}</b></>}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Cerrar"><X size={18} /></button>
      </div>

      <div className="space-y-5 p-4">
        <div className="grid grid-cols-2 gap-2">
          <a href={directions} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white">
            <Navigation size={16} /> Cómo llegar
          </a>
          <button onClick={share} className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm font-medium dark:border-zinc-700">
            <Share2 size={16} /> Compartir
          </button>
          <button
            onClick={() => setShowVisitForm(true)}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${visited ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "border border-zinc-200 dark:border-zinc-700"}`}
          >
            ✅ {visited ? "Fui · editar" : "Fui"}
          </button>
          <button
            onClick={toggleWishlist}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${wished ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "border border-zinc-200 dark:border-zinc-700"}`}
          >
            <Star size={16} fill={wished ? "currentColor" : "none"} /> {wished ? "Quiero ir ✓" : "Quiero ir"}
          </button>
        </div>
        {actionError && <p className="text-sm text-red-600">{actionError}</p>}

        {showVisitForm && (
          <VisitForm placeId={place.id} me={me} existing={myVisit} onDone={() => { setShowVisitForm(false); refresh(); supabase.from("visits").select("*").eq("place_id", place.id).order("visited_on", { ascending: false }).then(({ data }) => setVisits(data ?? [])); }} />
        )}

        <section className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Agregado por</span>
            <Avatars ids={[place.created_by]} profiles={profiles} size={20} />
            <span>{place.created_by_name}</span>
          </div>
          {place.visitor_ids.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Fueron</span>
              <Avatars ids={place.visitor_ids} profiles={profiles} size={20} />
            </div>
          )}
          {place.wishlist_ids.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Quieren ir</span>
              <Avatars ids={place.wishlist_ids} profiles={profiles} size={20} />
            </div>
          )}
        </section>

        {place.notes && <p className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">{place.notes}</p>}

        {place.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {place.tags.map((t) => <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">#{t}</span>)}
          </div>
        )}

        <section className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <Plane size={14} className="mt-1 text-zinc-500" />
            {place.trip_ids.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {trips.filter((t) => place.trip_ids.includes(t.id)).map((t) => (
                  <li key={t.id} className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    {t.emoji} {t.name}{!t.is_public && " 🔒"}
                    {(t.created_by === me || place.created_by === me) && (
                      <button onClick={() => removeFromTrip(t.id)} className="ml-0.5 text-zinc-400 hover:text-red-600" title="Quitar de este viaje">✕</button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-zinc-500">En ningún viaje</span>
            )}
          </div>
          {trips.some((t) => !place.trip_ids.includes(t.id)) && (
            <select onChange={(e) => addToTrip(e.target.value)} value="" className="w-full rounded-lg border border-zinc-200 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700">
              <option value="">+ Agregar a un viaje…</option>
              {trips.filter((t) => !place.trip_ids.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.name}{t.is_public ? "" : " 🔒"}</option>)}
            </select>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="font-medium">Reseñas</h3>
          {visits.length === 0 && <p className="text-sm text-zinc-500">Nadie fue todavía.</p>}
          {visits.map((v) => {
            const prof = profiles.find((p) => p.id === v.user_id);
            return (
              <div key={v.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  {prof && <Avatar profile={prof} size={22} />}
                  <span className="font-medium">{prof?.display_name}</span>
                  {v.rating && <span className="ml-auto">{"★".repeat(v.rating)}<span className="text-zinc-300">{"★".repeat(5 - v.rating)}</span></span>}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {new Date(v.visited_on).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                  {v.price_paid ? ` · pagó ${v.price_paid} ${v.currency ?? ""}` : ""}
                </div>
                {v.review && <p className="mt-2">{v.review}</p>}
              </div>
            );
          })}
        </section>

        {place.created_by === me && (
          <button onClick={removePlace} className="flex items-center gap-1 text-xs text-red-600"><Trash2 size={12} /> Borrar lugar</button>
        )}
      </div>
    </aside>
  );
}
