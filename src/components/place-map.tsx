"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import Supercluster from "supercluster";
import type { PlaceOverview } from "@/lib/types";
import { CATEGORIES, mainCategory } from "@/lib/types";

interface Props {
  places: PlaceOverview[];
  me: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

// Estilo del mapa base. Con MapTiler se ve mucho mejor; sin key cae a OSM crudo.
function mapStyle(): string | maplibregl.StyleSpecification {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) return `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

// Next/Turbopack resuelve mal la URL del web worker de MapLibre (el que procesa los
// tiles vectoriales), y sin worker el mapa queda vacío. Lo servimos desde /public.
// Los archivos se copian ahí en `npm install` (scripts/copy-maplibre-worker.mjs).
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

type PointProps = { id: string; category: PlaceOverview["categories"][number]; color: string; wish: boolean };

export function PlaceMap({ places, me, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const clusterRef = useRef<Supercluster<PointProps> | null>(null);
  const placesRef = useRef(places);
  useEffect(() => { placesRef.current = places; }, [places]);
  // Ubicación del usuario al abrir: mientras se resuelve, no encuadramos los lugares.
  const locateRef = useRef<"pending" | "ok" | "failed">("pending");
  const lastFitKeyRef = useRef<string>("");
  const initialSelectedRef = useRef(selectedId); // link compartido: ir al lugar, no a mi ubicación

  // Inicialización
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle(),
      center: [-58.38, -34.6], // Buenos Aires por defecto
      zoom: 2,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
      fitBoundsOptions: { maxZoom: 13 },
      trackUserLocation: false,
      showUserLocation: true,
    });
    map.addControl(geolocate, "top-right");
    mapRef.current = map;

    const render = () => renderMarkers(map, markersRef.current, clusterRef.current, onSelect);
    map.on("moveend", render);

    // Al abrir: centrar en la ubicación del usuario. Si falla o no da permiso,
    // encuadramos los lugares como antes.
    const fallbackFit = () => {
      if (locateRef.current !== "pending") return;
      locateRef.current = "failed";
      fitPlaces(map, placesRef.current);
    };
    geolocate.on("geolocate", () => { locateRef.current = "ok"; });
    geolocate.on("error", fallbackFit);
    const fallbackTimer = window.setTimeout(fallbackFit, 9000);

    map.on("load", () => {
      render();
      if (initialSelectedRef.current) { locateRef.current = "failed"; window.clearTimeout(fallbackTimer); return; }
      if (!("geolocation" in navigator)) fallbackFit();
      else geolocate.trigger();
    });

    return () => {
      window.clearTimeout(fallbackTimer);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recalcular clusters cuando cambian los lugares filtrados
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const index = new Supercluster<PointProps>({ radius: 50, maxZoom: 15 });
    index.load(
      places.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          category: mainCategory(p.categories),
          color: p.created_by_color,
          wish: !p.visitor_ids.length && p.wishlist_ids.includes(me),
        },
      })),
    );
    clusterRef.current = index;

    // Encuadrar los lugares filtrados, pero solo cuando cambia QUÉ lugares se muestran
    // (filtros, viaje), no en cada refresh de datos, y no mientras esperamos la ubicación inicial.
    const fitKey = places.map((p) => p.id).sort().join(",");
    const isFirst = lastFitKeyRef.current === "";
    const changed = fitKey !== lastFitKeyRef.current;
    lastFitKeyRef.current = fitKey;
    if (changed && !(isFirst && locateRef.current === "pending")) fitPlaces(map, places);

    if (map.loaded()) renderMarkers(map, markersRef.current, index, onSelect);
  }, [places, me, onSelect]);

  // Centrar en el seleccionado
  useEffect(() => {
    const map = mapRef.current;
    const p = placesRef.current.find((x) => x.id === selectedId);
    if (!map || !p) return;
    map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 14), duration: 400 });
  }, [selectedId]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function fitPlaces(map: maplibregl.Map, places: PlaceOverview[]) {
  if (places.length === 0) return;
  const bounds = new maplibregl.LngLatBounds();
  places.forEach((p) => bounds.extend([p.lng, p.lat]));
  map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 });
}

function renderMarkers(
  map: maplibregl.Map,
  markers: Map<string, maplibregl.Marker>,
  index: Supercluster<PointProps> | null,
  onSelect: (id: string) => void,
) {
  if (!index) return;
  const b = map.getBounds();
  const clusters = index.getClusters(
    [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
    Math.floor(map.getZoom()),
  );

  const seen = new Set<string>();

  for (const f of clusters) {
    const [lng, lat] = f.geometry.coordinates;
    const props = f.properties as PointProps & { cluster?: boolean; cluster_id?: number; point_count?: number };
    const key = props.cluster ? `c-${props.cluster_id}` : props.id;
    seen.add(key);
    if (markers.has(key)) continue;

    const el = document.createElement("div");
    if (props.cluster) {
      const n = props.point_count ?? 0;
      const size = 32 + Math.min(n, 50) * 0.6;
      el.className = "cluster";
      el.style.width = el.style.height = `${size}px`;
      el.textContent = String(n);
      el.onclick = () => {
        const zoom = index.getClusterExpansionZoom(props.cluster_id!);
        map.easeTo({ center: [lng, lat], zoom, duration: 400 });
      };
    } else {
      el.className = `marker${props.wish ? " wish" : ""}`;
      el.style.background = props.color;
      el.innerHTML = `<span>${CATEGORIES[props.category].emoji}</span>`;
      el.onclick = (e) => {
        e.stopPropagation();
        onSelect(props.id);
      };
    }

    const m = new maplibregl.Marker({ element: el, anchor: props.cluster ? "center" : "bottom" })
      .setLngLat([lng, lat])
      .addTo(map);
    markers.set(key, m);
  }

  for (const [key, m] of markers) {
    if (!seen.has(key)) {
      m.remove();
      markers.delete(key);
    }
  }
}
