"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Search, MapPin, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { searchPlaces, type PlaceResult } from "@/lib/places-search";
import type { CustomCategory, PlaceOverview, TripOverview } from "@/lib/types";
import { CATEGORIES, PRICE_LABELS, DEFAULT_PIN, categoryInfo, placeEmoji } from "@/lib/types";

interface Props {
  me: string;
  trips: TripOverview[];         // solo los viajes donde puedo agregar (creador o miembro)
  customs: CustomCategory[];
  defaultTripId?: string;
  /** Lugar ya elegido (tocado en el mapa): saltea la búsqueda. */
  preset?: PlaceResult;
  /** Lugar existente a editar (nombre, categorías, notas, tags). */
  editing?: PlaceOverview;
  onClose: () => void;
  /** Se guardó (o se adoptó) un lugar: abrirlo. */
  onSaved?: (placeId: string) => void;
}

const EMOJI_SUGGESTIONS = ["🏟️", "🎭", "🏛️", "⛪", "🏖️", "🎡", "🏋️", "💈", "🏥", "🎓", "🍦", "🍕", "🍣", "🍷", "🎶", "🛍️", "⛺", "🚗", "🐾", "📍"];

export function AddPlaceDialog({ me, trips, customs, defaultTripId = "", preset, editing, onClose, onSaved }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<PlaceResult | null>(
    editing
      ? { name: editing.name, lat: editing.lat, lng: editing.lng, address: editing.address, city: editing.city, region: editing.region, country: editing.country, country_code: editing.country_code, price_level: editing.price_level, google_place_id: editing.google_place_id, website: editing.website, categories: editing.categories }
      : preset ?? null,
  );
  const [name, setName] = useState(editing?.name ?? preset?.name ?? "");
  const [categories, setCategories] = useState<string[]>(editing?.categories ?? preset?.categories ?? []);
  const [price, setPrice] = useState<number>(editing?.price_level ?? 0);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [region, setRegion] = useState(editing?.region ?? "");
  const [tags, setTags] = useState(editing?.tags.join(", ") ?? "");
  const [tripId, setTripId] = useState(defaultTripId);
  const [addToWishlist, setAddToWishlist] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Categorías del grupo creadas en este diálogo (todavía no guardadas)
  const [localCustoms, setLocalCustoms] = useState<CustomCategory[]>([]);
  const allCustoms = [...customs, ...localCustoms];
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("");

  // Búsqueda con pausa
  function onQueryChange(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    setError(null);
    if (value.trim().length < 3) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(value));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSearching(false);
      }
    }, 600);
  }

  function pick(r: PlaceResult) {
    setPicked(r);
    setName(r.name);
    setCategories(r.categories);
    setPrice(r.price_level ?? 0);
    setResults([]);
  }

  const toggleCat = (k: string) => setCategories((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  function addNewCategory() {
    const n = newCatName.trim();
    if (!n) return;
    const preKey = Object.keys(CATEGORIES).find((k) => k === n.toLowerCase() || CATEGORIES[k].label.toLowerCase() === n.toLowerCase());
    const existing = allCustoms.find((c) => c.name.toLowerCase() === n.toLowerCase());
    const key = preKey ?? existing?.name ?? n;
    if (!preKey && !existing) {
      setLocalCustoms((l) => [...l, { name: n, emoji: newCatEmoji.trim() || null, created_by: me, created_at: new Date().toISOString() }]);
    }
    if (!categories.includes(key)) setCategories((c) => [...c, key]);
    setNewCatName("");
    setNewCatEmoji("");
    setNewCatOpen(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setSaving(true);
    setError(null);

    // 1. Guardar categorías nuevas del grupo (si otro las creó mientras tanto, no pasa nada)
    if (localCustoms.length) {
      const { error } = await supabase
        .from("custom_categories")
        .upsert(localCustoms.map((c) => ({ name: c.name, emoji: c.emoji, created_by: me })), { onConflict: "name", ignoreDuplicates: true });
      if (error) { setSaving(false); setError(error.message); return; }
    }

    const tagList = tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const finalName = name.trim() || picked.name || "Lugar sin nombre";

    // 2. Editar
    if (editing) {
      const { error } = await supabase
        .from("places")
        .update({ name: finalName, categories, price_level: price || null, notes: notes.trim() || null, tags: tagList, region: region.trim() || null })
        .eq("id", editing.id);
      setSaving(false);
      if (error) { setError(error.message); return; }
      router.refresh();
      onClose();
      return;
    }

    // 3. Crear
    const { data: place, error } = await supabase
      .from("places")
      .insert({
        name: finalName,
        categories,
        lat: picked.lat,
        lng: picked.lng,
        address: picked.address,
        city: picked.city,
        region: picked.region,
        country: picked.country,
        country_code: picked.country_code,
        price_level: price || null,
        google_place_id: picked.google_place_id,
        website: picked.website,
        notes: notes.trim() || null,
        tags: tagList,
        created_by: me,
      })
      .select()
      .single();

    if (error || !place) {
      // Ya existe con ese Google Place ID. Si no lo vemos (está en un viaje privado de otro),
      // lo "adoptamos": se suma a nuestro "quiero ir" y pasa a ser visible para nosotros.
      if (error?.code === "23505" && picked.google_place_id) {
        const { data: existingId } = await supabase.rpc("adopt_existing_place", { p_google_place_id: picked.google_place_id });
        setSaving(false);
        if (existingId) {
          router.refresh();
          onClose();
          onSaved?.(existingId);
          return;
        }
      }
      setSaving(false);
      setError(error?.code === "23505" ? "Ese lugar ya está cargado." : error?.message ?? "Error");
      return;
    }

    const extras = await Promise.all([
      tripId ? supabase.from("trip_places").insert({ trip_id: tripId, place_id: place.id, added_by: me }) : null,
      addToWishlist ? supabase.from("wishlist").insert({ place_id: place.id, user_id: me }) : null,
    ]);
    const extraErr = extras.find((r) => r?.error)?.error;
    if (extraErr) { setSaving(false); setError(`El lugar se guardó, pero: ${extraErr.message}`); router.refresh(); return; }

    router.refresh();
    onClose();
    onSaved?.(place.id);
  }

  const input = "w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";
  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-sm ${active ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-700"}`;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{editing ? "Editar lugar" : "Agregar lugar"}</h2>
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
              <p className="text-xs text-zinc-500">Sin resultados. Probá con el nombre y la ciudad, ej. “Don Julio Buenos Aires”. También podés tocar el punto directamente en el mapa.</p>
            )}
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {results.map((r, i) => (
                <li key={r.google_place_id ?? i}>
                  <button onClick={() => pick(r)} className="flex w-full items-start gap-2 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <span className="mt-0.5 text-lg">{placeEmoji(r.categories)}</span>
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
              <MapPin size={18} className="mt-2 shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  required
                  autoFocus={!picked.name}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del lugar"
                  className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 font-medium dark:border-zinc-700 dark:bg-zinc-900"
                />
                <div className="text-xs text-zinc-500">{picked.address ?? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`}</div>
              </div>
              {!editing && <button type="button" onClick={() => setPicked(null)} className="text-xs text-zinc-500 underline">buscar otro</button>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Categorías <span className="font-normal">(podés elegir varias; la primera es la del ícono)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <button type="button" key={k} onClick={() => toggleCat(k)} className={chip(categories.includes(k))}>
                    {v.emoji} {v.label}
                  </button>
                ))}
                {allCustoms.map((c) => (
                  <button type="button" key={c.name} onClick={() => toggleCat(c.name)} className={chip(categories.includes(c.name))}>
                    {c.emoji ?? DEFAULT_PIN} {c.name}
                  </button>
                ))}
                <button type="button" onClick={() => setNewCatOpen((o) => !o)} className="flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2.5 py-1 text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-300">
                  <Plus size={13} /> Nueva
                </button>
              </div>

              {newCatOpen && (
                <div className="mt-2 space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="flex gap-2">
                    <input
                      value={newCatEmoji}
                      onChange={(e) => setNewCatEmoji(e.target.value)}
                      placeholder={DEFAULT_PIN}
                      maxLength={4}
                      className={`${input} w-14 text-center`}
                      title="Emoji (opcional)"
                    />
                    <input
                      autoFocus
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewCategory(); } }}
                      placeholder="Nombre, ej. Estadio"
                      maxLength={40}
                      className={input}
                    />
                    <button type="button" onClick={addNewCategory} disabled={!newCatName.trim()} className="rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900">OK</button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {EMOJI_SUGGESTIONS.map((e) => (
                      <button type="button" key={e} onClick={() => setNewCatEmoji(e)} className={`rounded-md px-1.5 py-0.5 text-lg ${newCatEmoji === e ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>{e}</button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500">El emoji es opcional; sin emoji el lugar muestra un pin. La categoría queda disponible para todo el grupo.</p>
                </div>
              )}

              {categories.length > 0 && (
                <p className="mt-1 text-xs text-zinc-500">Ícono: {categoryInfo(categories[0], allCustoms).emoji} {categoryInfo(categories[0], allCustoms).label}</p>
              )}
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

            {editing && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Provincia / Región <span className="font-normal">(para el filtro)</span></label>
                <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="ej. Córdoba, Santiago del Estero, Wien" className={input} />
              </div>
            )}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas: por qué lo agregás, qué pedir, etc." rows={2} className={input} />
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags separados por coma: ramen, barato, terraza" className={input} />

            {!editing && trips.length > 0 && (
              <select value={tripId} onChange={(e) => setTripId(e.target.value)} className={input}>
                <option value="">Sin viaje</option>
                {trips.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.name}{t.is_public ? "" : " 🔒"}</option>)}
              </select>
            )}
            {!editing && tripId && trips.find((t) => t.id === tripId)?.is_public === false && (
              <p className="-mt-1 text-xs text-amber-700 dark:text-amber-400">🔒 Viaje privado: este lugar solo lo van a ver los miembros del viaje hasta que se haga público.</p>
            )}

            {!editing && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={addToWishlist} onChange={(e) => setAddToWishlist(e.target.checked)} />
                Agregarlo a mi “quiero ir”
              </label>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={saving} className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Guardar lugar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
