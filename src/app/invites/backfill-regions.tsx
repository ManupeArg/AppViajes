"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { reverseGeocode } from "@/lib/places-search";

/**
 * Herramienta de admin: completa la provincia/región de los lugares que no la
 * tienen (los cargados antes de que existiera el campo).
 */
export function BackfillRegions() {
  const supabase = createClient();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setStatus("Buscando lugares sin provincia…");
    const { data: places, error } = await supabase.from("places").select("id,name,lat,lng").is("region", null);
    if (error) { setStatus(error.message); setBusy(false); return; }
    if (!places?.length) { setStatus("Todos los lugares ya tienen provincia."); setBusy(false); return; }

    let done = 0, failed = 0;
    for (const p of places) {
      setStatus(`Completando ${done + failed + 1} de ${places.length}: ${p.name}…`);
      const geo = await reverseGeocode(p.lat, p.lng);
      if (geo.region) {
        const { error } = await supabase.from("places").update({ region: geo.region }).eq("id", p.id);
        if (error) failed++; else done++;
      } else {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 250)); // no saturar la API
    }
    setStatus(`Listo: ${done} completados${failed ? `, ${failed} sin dato (completalos a mano desde "Editar")` : ""}.`);
    setBusy(false);
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium">Herramientas</h2>
      <p className="mt-1 text-sm text-zinc-500">Completa la provincia/región de los lugares cargados antes de que existiera el filtro.</p>
      <button onClick={run} disabled={busy} className="mt-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700">
        {busy ? "Trabajando…" : "Completar provincias"}
      </button>
      {status && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{status}</p>}
    </div>
  );
}
