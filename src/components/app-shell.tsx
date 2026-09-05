"use client";

import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Map as MapIcon, List, Plus, Activity, Plane, LogOut } from "lucide-react";
import type { CustomCategory, PlaceOverview, Profile, TripOverview } from "@/lib/types";
import { applyFilters, filtersFromParams, filtersToParams, type Filters } from "@/lib/filters";
import { FilterBar } from "./filter-bar";
import { PlaceList } from "./place-list";
import { PlaceSheet } from "./place-sheet";
import { AddPlaceDialog } from "./add-place-dialog";
import { TripsDialog } from "./trips-dialog";
import type { PlaceResult } from "@/lib/places-search";
import { Avatar } from "./avatars";

// MapLibre necesita window: se carga solo en el cliente.
const PlaceMap = dynamic(() => import("./place-map").then((m) => m.PlaceMap), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-zinc-500">Cargando mapa…</div>,
});

interface Props {
  me: string;
  email: string;
  isAdmin: boolean;
  places: PlaceOverview[];
  profiles: Profile[];
  trips: TripOverview[];
  customs: CustomCategory[];
}

export function AppShell({ me, email, isAdmin, places, profiles, trips, customs }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const view = searchParams.get("view") === "list" ? "list" : "map";

  // ?place=<id> viene de los links compartidos (/p/<id>)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("place"));
  const [adding, setAdding] = useState<false | true | PlaceResult>(false); // true = buscar; PlaceResult = punto elegido en el mapa
  const [editing, setEditing] = useState<PlaceOverview | null>(null);
  const [showTrips, setShowTrips] = useState(false);

  const filtered = useMemo(() => applyFilters(places, filters, me), [places, filters, me]);
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const activeTrip = trips.find((t) => t.id === filters.trip) ?? null;
  const meProfile = profiles.find((p) => p.id === me);
  // Viajes a los que puedo agregar lugares: creador o miembro
  const myTrips = useMemo(() => trips.filter((t) => t.created_by === me || t.member_ids.includes(me)), [trips, me]);

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
        <h1 className="hidden font-semibold sm:block">MApp</h1>
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
              className={`tip rounded-md px-2.5 py-1.5 text-sm ${view === "map" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : ""}`}
              data-tip="Mapa"
              aria-label="Vista mapa"
            >
              <MapIcon size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`tip rounded-md px-2.5 py-1.5 text-sm ${view === "list" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : ""}`}
              data-tip="Listado"
              aria-label="Vista lista"
            >
              <List size={16} />
            </button>
          </div>
          <button onClick={() => setShowTrips(true)} className="tip rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" data-tip="Viajes" aria-label="Viajes">
            <Plane size={18} />
          </button>
          <a href="/feed" className="tip rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" data-tip="Actividad" aria-label="Actividad">
            <Activity size={18} />
          </a>
          <button
            onClick={() => setAdding(true)}
            className="tip flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            data-tip="Agregar lugar"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Agregar</span>
          </button>
          <form action="/auth/signout" method="post" className="ml-1 flex items-center gap-1 border-l border-zinc-200 pl-2 dark:border-zinc-700">
            {meProfile && <span className="tip inline-flex" data-tip={`${meProfile.display_name} · ${email}${isAdmin ? " · admin" : ""}`}><Avatar profile={meProfile} size={26} /></span>}
            <button type="submit" className="tip rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800" data-tip="Cerrar sesión" aria-label="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </header>

      <FilterBar filters={filters} onChange={setFilters} places={places} profiles={profiles} customs={customs} count={filtered.length} />

      <main className="relative min-h-0 flex-1">
        {view === "map" ? (
          <PlaceMap places={filtered} customs={customs} me={me} selectedId={selectedId} onSelect={setSelectedId} onAddAt={(preset) => { setSelectedId(null); setAdding(preset); }} />
        ) : (
          <PlaceList places={filtered} profiles={profiles} customs={customs} me={me} onSelect={setSelectedId} />
        )}

        {selected && (
          <PlaceSheet place={selected} profiles={profiles} trips={trips} customs={customs} me={me} onClose={() => setSelectedId(null)} onEdit={setEditing} />
        )}
      </main>

      {adding && <AddPlaceDialog me={me} trips={myTrips} customs={customs} defaultTripId={myTrips.some((t) => t.id === filters.trip) ? filters.trip : ""} preset={adding === true ? undefined : adding} onClose={() => setAdding(false)} onSaved={setSelectedId} />}
      {editing && <AddPlaceDialog me={me} trips={myTrips} customs={customs} editing={editing} onClose={() => setEditing(null)} />}
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
