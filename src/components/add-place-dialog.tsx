"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Search, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { searchPlaces, type PlaceResult } from "@/lib/places-search";
import type { PlaceCategory, TripOverview } from "@/lib/types";
import { CATEGORIES, PRICE_LABELS } from "@/lib/types";

interface Props {
  me: string;
  trips: TripOverview[];
  defaultTripId?: string;
  onClose: () => void;
}

export function AddPlaceDialog({ me, trips, defaultTripId = "", onClose }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<PlaceResult | null>(null);
  const [categories, setCategories] = useState<PlaceCategory[]>([]);
  const [price, setPrice] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [tripId, setTripId] = useState(defaultTripId);
  const [addToWishlist, setAddToWishlist] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Búsqueda con debounce
  function onQueryChange(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    if (value.trim().length < 3) { setResults([]); return; }
    setError(null);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(value));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSearching(false);
      }
    }, 500);
  }

  function pick(r: PlaceResult) {
    setPicked(r);
    setCategories(r.categories);
    setPrice(r.price_level ?? 0);
    setResults([]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setSaving(true);
    setError(null);

    const { data: place, error } = await supabase
      .from("places")
      .insert({
        name: picked.name,
        categories: categories.length ? categories : ["otro"],
        lat: picked.lat,
        lng: picked.lng,
        address: picked.address,
        city: picked.city,
        country: picked.country,
        country_code: picked.country_code,
        price_level: price || null,
        google_place_id: picked.google_place_id,
        website: picked.website,
        notes: notes.trim() || null,
        tags: tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
        created_by: me,
      })
      .select()
      .single();

    if (error || !place) {
      setSaving(false);
      setError(error?.code === "23505" ? "Ese lugar ya está cargado." : error?.message ?? "Error");
      return;
    }

    await Promise.all([
      tripId ? supabase.from("trip_places").insert({ trip_id: tripId, place_id: place.id, added_by: me }) : null,
      addToWishlist ? supabase.from("wishlist").insert({ place_id: place.id, user_id: me }) : null,
    ]);

    router.refresh();
    onClose();
  }

  const input = "w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Agregar lugar</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {!picked ? (
          <div className="space-y-2">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input autoFocus value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Nombre del lugar, ej. Ichiran Shibuya" className={`${input} pl-9`} />
            </div>
            {searching && <p className="text-xs text-zinc-500">Buscando…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {!searching && !error && query.trim().length >= 3 && results.length === 0 && (
              <p className="text-xs text-zinc-500">Sin resultados. Probá con el nombre y la ciudad, ej. “Don Julio Buenos Aires”.</p>
            )}
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {results.map((r, i) => (
                <li key={r.google_place_id ?? i}>
                  <button onClick={() => pick(r)} className="flex w-full items-start gap-2 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <span className="mt-0.5 text-lg">{CATEGORIES[r.categories[0] ?? "otro"].emoji}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-zinc-500">{r.address}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (
              <p className="text-xs text-zinc-400">Usando OpenStreetMap para buscar. Con una key de Google Places los resultados mejoran mucho.</p>
            )}
          </div>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <MapPin size={18} className="mt-0.5 shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{picked.name}</div>
                <div className="text-xs text-zinc-500">{picked.address}</div>
              </div>
              <button type="button" onClick={() => setPicked(null)} className="text-xs text-zinc-500 underline">cambiar</button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Categorías <span className="font-normal">(podés elegir varias; la primera es la del ícono)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(CATEGORIES) as PlaceCategory[]).map((k) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setCategories((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))}
                    className={`rounded-full border px-2.5 py-1 text-sm ${categories.includes(k) ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-700"}`}
                  >
                    {CATEGORIES[k].emoji} {CATEGORIES[k].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Precio</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <button type="button" key={n} onClick={() => setPrice(price === n ? 0 : n)} className={`flex-1 rounded-lg border py-1.5 text-sm ${price === n ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-700"}`}>
                    {PRICE_LABELS[n]}
                  </button>
                ))}
              </div>
            </div>

            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas: por qué lo agregás, qué pedir, etc." rows={2} className={input} />
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags separados por coma: ramen, barato, terraza" className={input} />

            {trips.length > 0 && (
              <select value={tripId} onChange={(e) => setTripId(e.target.value)} className={input}>
                <option value="">Sin viaje</option>
                {trips.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.name}{t.is_public ? "" : " 🔒"}</option>)}
              </select>
            )}
            {tripId && trips.find((t) => t.id === tripId)?.is_public === false && (
              <p className="-mt-1 text-xs text-amber-700 dark:text-amber-400">🔒 Viaje privado: este lugar solo lo van a ver los miembros del viaje hasta que se haga público.</p>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={addToWishlist} onChange={(e) => setAddToWishlist(e.target.checked)} />
              Agregarlo a mi “quiero ir”
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={saving} className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
              {saving ? "Guardando…" : "Guardar lugar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
