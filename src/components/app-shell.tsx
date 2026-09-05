"use client";

import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Map as MapIcon, List, Plus, Activity, Plane, LogOut } from "lucide-react";
import type { PlaceOverview, Profile, TripOverview } from "@/lib/types";
import { applyFilters, filtersFromParams, filtersToParams, type Filters } from "@/lib/filters";
import { FilterBar } from "./filter-bar";
import { PlaceList } from "./place-list";
import { PlaceSheet } from "./place-sheet";
import { AddPlaceDialog } from "./add-place-dialog";
import { TripsDialog } from "./trips-dialog";
import { Avatar } from "./avatars";

// MapLibre necesita window: se carga solo en el cliente.
const PlaceMap = dynamic(() => import("./place-map").then((m) => m.PlaceMap), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-zinc-500">Cargando mapa…</div>,
});

interface Props {
  me: string;
  isAdmin: boolean;
  places: PlaceOverview[];
  profiles: Profile[];
  trips: TripOverview[];
}

export function AppShell({ me, isAdmin, places, profiles, trips }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const view = searchParams.get("view") === "list" ? "list" : "map";

  // ?place=<id> viene de los links compartidos (/p/<id>)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("place"));
  const [adding, setAdding] = useState(false);
  const [showTrips, setShowTrips] = useState(false);

  const filtered = useMemo(() => applyFilters(places, filters, me), [places, filters, me]);
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const activeTrip = trips.find((t) => t.id === filters.trip) ?? null;
  const meProfile = profiles.find((p) => p.id === me);

  const setFilters = useCallback(
    (next: Filters) => {
      const sp = filtersToParams(next);
      if (view === "list") sp.set("view", "list");
      router.replace(`/?${sp.toString()}`, { scroll: false });
    },
    [router, view],
  );

  const setView = (v: "map" | "list") => {
    const sp = filtersToParams(filters);
    if (v === "list") sp.set("view", "list");
    router.replace(`/?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-xl">🗺️</span>
        <h1 className="hidden font-semibold sm:block">Mapa de amigos</h1>
        {activeTrip && (
          <button
            onClick={() => setFilters({ ...filters, trip: "" })}
            className="ml-1 max-w-[45vw] truncate rounded-full bg-zinc-900 px-3 py-1 text-xs text-white sm:max-w-none dark:bg-white dark:text-zinc-900"
            title="Quitar filtro de viaje"
          >
            {activeTrip.emoji} {activeTrip.name}{!activeTrip.is_public && " 🔒"} ✕
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
            <button
              onClick={() => setView("map")}
              className={`rounded-md px-2.5 py-1.5 text-sm ${view === "map" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : ""}`}
              aria-label="Vista mapa"
            >
              <MapIcon size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`rounded-md px-2.5 py-1.5 text-sm ${view === "list" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : ""}`}
              aria-label="Vista lista"
            >
              <List size={16} />
            </button>
          </div>
          <button onClick={() => setShowTrips(true)} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Viajes">
            <Plane size={18} />
          </button>
          <a href="/feed" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Actividad">
            <Activity size={18} />
          </a>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Agregar</span>
          </button>
          <form action="/auth/signout" method="post" className="ml-1 flex items-center gap-1 border-l border-zinc-200 pl-2 dark:border-zinc-700">
            {meProfile && <Avatar profile={meProfile} size={26} />}
            <button type="submit" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800" aria-label="Cerrar sesión" title={`Salir${isAdmin ? " (admin)" : ""}`}>
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </header>

      <FilterBar filters={filters} onChange={setFilters} places={places} profiles={profiles} trips={trips} count={filtered.length} />

      <main className="relative min-h-0 flex-1">
        {view === "map" ? (
          <PlaceMap places={filtered} me={me} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <PlaceList places={filtered} profiles={profiles} me={me} onSelect={setSelectedId} />
        )}

        {selected && (
          <PlaceSheet place={selected} profiles={profiles} trips={trips} me={me} onClose={() => setSelectedId(null)} />
        )}
      </main>

      {adding && <AddPlaceDialog me={me} trips={trips} defaultTripId={filters.trip} onClose={() => setAdding(false)} />}
      {showTrips && (
        <TripsDialog
          trips={trips}
          profiles={profiles}
          me={me}
          activeTripId={filters.trip}
          onSelect={(id) => { setFilters({ ...filters, trip: id }); setShowTrips(false); }}
          onClose={() => setShowTrips(false)}
        />
      )}
    </div>
  );
}
