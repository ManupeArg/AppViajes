"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/lib/types";

interface Props {
  trips: Trip[];
  me: string;
  activeTripId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function TripsDialog({ trips, me, activeTripId, onSelect, onClose }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✈️");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data } = await supabase
      .from("trips")
      .insert({ name: name.trim(), emoji, starts_on: starts || null, ends_on: ends || null, created_by: me })
      .select()
      .single();
    setSaving(false);
    router.refresh();
    if (data) onSelect(data.id);
  }

  const input = "w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Viajes</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <ul className="mb-3 space-y-1">
          {activeTripId && (
            <li>
              <button onClick={() => onSelect("")} className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                🌍 Ver todo el mapa
              </button>
            </li>
          )}
          {trips.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 ${t.id === activeTripId ? "bg-zinc-100 font-medium dark:bg-zinc-800" : ""}`}
              >
                <span className="text-xl">{t.emoji}</span>
                <span className="flex-1">
                  {t.name}
                  {(t.starts_on || t.ends_on) && (
                    <span className="block text-xs text-zinc-500">{[t.starts_on, t.ends_on].filter(Boolean).join(" → ")}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {trips.length === 0 && !creating && <li className="px-3 text-sm text-zinc-500">Todavía no hay viajes.</li>}
        </ul>

        {creating ? (
          <form onSubmit={create} className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="flex gap-2">
              <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className={`${input} w-14 text-center`} maxLength={4} />
              <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Viaje a Japón 2026" className={input} />
            </div>
            <div className="flex gap-2">
              <input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} className={input} />
              <input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} className={input} />
            </div>
            <button disabled={saving} className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">Crear viaje</button>
          </form>
        ) : (
          <button onClick={() => setCreating(true)} className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            <Plus size={14} /> Nuevo viaje
          </button>
        )}
      </div>
    </div>
  );
}
