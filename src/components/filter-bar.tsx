"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { CustomCategory, PlaceOverview, Profile } from "@/lib/types";
import { CATEGORIES, PRICE_LABELS } from "@/lib/types";
import { DEFAULT_FILTERS, uniqueSorted, type Filters, type SortKey } from "@/lib/filters";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  places: PlaceOverview[];
  profiles: Profile[];
  customs: CustomCategory[];
  count: number;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Más nuevos" },
  { key: "rating", label: "Mejor puntaje" },
  { key: "price", label: "Más baratos" },
  { key: "visits", label: "Más visitados" },
  { key: "name", label: "Nombre" },
];

const select =
  "rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export function FilterBar({ filters, onChange, places, profiles, customs, count }: Props) {
  const countries = uniqueSorted(places.map((p) => p.country));
  const regions = uniqueSorted(
    places.filter((p) => !filters.country || p.country === filters.country).map((p) => p.region),
  );
  const isDirty = JSON.stringify({ ...filters, sort: "newest", trip: "" }) !== JSON.stringify({ ...DEFAULT_FILTERS, trip: "" });
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });

  // El texto de búsqueda se escribe localmente y se aplica con una pausa de 400 ms,
  // para no recargar en cada tecla.
  const [q, setQ] = useState(filters.q);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => {
    // Si el filtro cambió desde afuera (p. ej. "limpiar"), sincronizamos el input
    if (filters.q !== q && !qTimer.current) setQ(filters.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);
  const onQ = (value: string) => {
    setQ(value);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => {
      qTimer.current = null;
      onChange({ ...filtersRef.current, q: value });
    }, 400);
  };

  // Categorías usadas por algún lugar + predefinidas + del grupo, sin repetir
  const catOptions = [
    ...Object.entries(CATEGORIES).map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` })),
    ...customs.map((c) => ({ value: c.name, label: `${c.emoji ?? "📍"} ${c.name}` })),
  ];

  return (
    <div className="flex items-center border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
      <div className="relative shrink-0">
        <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Buscar nombre, tag, ciudad…"
          className={`${select} w-44 pl-7`}
        />
      </div>

      <select value={filters.country} onChange={(e) => onChange({ ...filters, country: e.target.value, region: "" })} className={select}>
        <option value="">País</option>
        {countries.map((c) => <option key={c}>{c}</option>)}
      </select>

      <select value={filters.region} onChange={(e) => set("region", e.target.value)} className={select}>
        <option value="">Provincia / Región</option>
        {regions.map((c) => <option key={c}>{c}</option>)}
      </select>

      <select value={filters.category} onChange={(e) => set("category", e.target.value)} className={select}>
        <option value="">Categoría</option>
        {catOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select value={filters.maxPrice} onChange={(e) => set("maxPrice", Number(e.target.value))} className={select}>
        <option value={0}>Precio</option>
        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>hasta {PRICE_LABELS[n]}</option>)}
      </select>

      <select value={filters.minRating} onChange={(e) => set("minRating", Number(e.target.value))} className={select}>
        <option value={0}>Puntaje</option>
        {[3, 4, 4.5].map((n) => <option key={n} value={n}>★ {n}+</option>)}
      </select>

      <select value={filters.user} onChange={(e) => set("user", e.target.value)} className={select}>
        <option value="">Agregado por</option>
        {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
      </select>

      <button
        onClick={() => set("onlyWishlist", !filters.onlyWishlist)}
        className={`shrink-0 rounded-lg border px-2 py-1.5 text-sm ${filters.onlyWishlist ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950" : "border-zinc-200 dark:border-zinc-700"}`}
      >
        ⭐ Quiero ir
      </button>
      <button
        onClick={() => set("onlyVisited", !filters.onlyVisited)}
        className={`shrink-0 rounded-lg border px-2 py-1.5 text-sm ${filters.onlyVisited ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950" : "border-zinc-200 dark:border-zinc-700"}`}
      >
        ✅ Fui
      </button>

      <select value={filters.sort} onChange={(e) => set("sort", e.target.value as SortKey)} className={select}>
        {SORTS.map((s) => <option key={s.key} value={s.key}>↕ {s.label}</option>)}
      </select>

      {isDirty && (
        <button onClick={() => { setQ(""); onChange({ ...DEFAULT_FILTERS, trip: filters.trip }); }} className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Limpiar filtros">
          <X size={16} />
        </button>
      )}

    </div>
    <span className="shrink-0 border-l border-zinc-200 px-3 text-xs text-zinc-500 dark:border-zinc-800">{count} {count === 1 ? "lugar" : "lugares"}</span>
    </div>
  );
}
