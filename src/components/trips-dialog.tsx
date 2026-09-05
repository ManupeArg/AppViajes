"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Lock, Globe, ChevronLeft, UserPlus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, TripOverview } from "@/lib/types";
import { Avatar } from "./avatars";

interface Props {
  trips: TripOverview[];
  profiles: Profile[];
  me: string;
  activeTripId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const input = "w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";
const btnDark = "rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900 disabled:opacity-50";

export function TripsDialog({ trips, profiles, me, activeTripId, onSelect, onClose }: Props) {
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);

  const managed = trips.find((t) => t.id === managing) ?? null;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          {managed ? (
            <button onClick={() => setManaging(null)} className="flex items-center gap-1 text-lg font-semibold">
              <ChevronLeft size={18} /> {managed.emoji} {managed.name}
            </button>
          ) : (
            <h2 className="text-lg font-semibold">Viajes</h2>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {managed ? (
          <ManageTrip trip={managed} profiles={profiles} me={me} onDone={() => setManaging(null)} />
        ) : (
          <>
            <ul className="mb-3 space-y-1">
              {activeTripId && (
                <li>
                  <button onClick={() => onSelect("")} className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    🌍 Ver todo el mapa
                  </button>
                </li>
              )}
              {trips.map((t) => (
                <li key={t.id} className={`flex items-center rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 ${t.id === activeTripId ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}>
                  <button onClick={() => onSelect(t.id)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left">
                    <span className="text-xl">{t.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`flex items-center gap-1.5 ${t.id === activeTripId ? "font-medium" : ""}`}>
                        <span className="truncate">{t.name}</span>
                        {t.is_public ? <Globe size={13} className="shrink-0 text-zinc-400" /> : <Lock size={13} className="shrink-0 text-amber-600" />}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {t.places_count} {t.places_count === 1 ? "lugar" : "lugares"}
                        {(t.starts_on || t.ends_on) && ` · ${[t.starts_on, t.ends_on].filter(Boolean).join(" → ")}`}
                        {!t.is_public && ` · ${1 + t.member_ids.length} ${t.member_ids.length === 0 ? "persona" : "personas"}`}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => setManaging(t.id)}
                    className="mr-1 rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    title={t.created_by === me ? "Miembros y visibilidad" : "Ver miembros"}
                  >
                    <UserPlus size={16} />
                  </button>
                </li>
              ))}
              {trips.length === 0 && !creating && <li className="px-3 text-sm text-zinc-500">Todavía no hay viajes.</li>}
            </ul>

            {creating ? (
              <NewTripForm me={me} onCreated={(id) => { setCreating(false); onSelect(id); }} onCancel={() => setCreating(false)} />
            ) : (
              <button onClick={() => setCreating(true)} className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                <Plus size={14} /> Nuevo viaje
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function NewTripForm({ me, onCreated, onCancel }: { me: string; onCreated: (id: string) => void; onCancel: () => void }) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✈️");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from("trips")
      .insert({ name: name.trim(), emoji, starts_on: starts || null, ends_on: ends || null, is_public: isPublic, created_by: me })
      .select()
      .single();
    setSaving(false);
    if (error || !data) { setError(error?.message ?? "Error"); return; }
    router.refresh();
    onCreated(data.id);
  }

  return (
    <form onSubmit={create} className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex gap-2">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className={`${input} w-14 text-center`} maxLength={4} />
        <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Viaje a Tucumán" className={input} />
      </div>
      <div className="flex gap-2">
        <input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} className={input} />
        <input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} className={input} />
      </div>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setIsPublic(false)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm ${!isPublic ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "border-zinc-200 dark:border-zinc-700"}`}>
          <Lock size={14} /> Privado
        </button>
        <button type="button" onClick={() => setIsPublic(true)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm ${isPublic ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-700"}`}>
          <Globe size={14} /> Para todos
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        {isPublic
          ? "Todo el grupo ve el viaje y sus lugares."
          : "Solo vos y las personas que agregues ven el viaje y sus lugares. Después lo podés hacer público."}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={saving} className={`flex-1 ${btnDark}`}>Crear viaje</button>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm text-zinc-500">Cancelar</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
function ManageTrip({ trip, profiles, me, onDone }: { trip: TripOverview; profiles: Profile[]; me: string; onDone: () => void }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = trip.created_by === me;
  const owner = profiles.find((p) => p.id === trip.created_by);
  const members = trip.member_ids.map((id) => profiles.find((p) => p.id === id)).filter((p): p is Profile => !!p);
  const candidates = profiles.filter((p) => p.id !== trip.created_by && !trip.member_ids.includes(p.id));

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(error.message);
    else router.refresh();
  }

  const addMember = (userId: string) => run(() => supabase.from("trip_members").insert({ trip_id: trip.id, user_id: userId, added_by: me }));
  const removeMember = (userId: string) => run(() => supabase.from("trip_members").delete().match({ trip_id: trip.id, user_id: userId }));
  const setPublic = (v: boolean) => {
    if (v && !window.confirm("¿Hacer público el viaje? Todo el grupo va a ver el viaje y sus lugares.")) return;
    run(() => supabase.from("trips").update({ is_public: v }).eq("id", trip.id));
  };
  async function deleteTrip() {
    if (!window.confirm(`¿Borrar "${trip.name}"? Los lugares no se borran, solo dejan de estar en el viaje.`)) return;
    await run(() => supabase.from("trips").delete().eq("id", trip.id));
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${trip.is_public ? "bg-zinc-100 dark:bg-zinc-800" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}>
        {trip.is_public ? <Globe size={16} /> : <Lock size={16} />}
        <span className="flex-1">{trip.is_public ? "Público: lo ve todo el grupo." : "Privado: solo lo ven las personas de esta lista."}</span>
        {isOwner && (
          <button onClick={() => setPublic(!trip.is_public)} disabled={busy} className="rounded-lg border border-current px-2 py-1 text-xs font-medium">
            {trip.is_public ? "Hacer privado" : "Hacer público"}
          </button>
        )}
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Personas</h3>
        <ul className="space-y-1">
          {owner && (
            <li className="flex items-center gap-2 text-sm">
              <Avatar profile={owner} size={26} />
              <span className="flex-1">{owner.display_name}</span>
              <span className="text-xs text-zinc-400">creador</span>
            </li>
          )}
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <Avatar profile={m} size={26} />
              <span className="flex-1">{m.display_name}</span>
              {(isOwner || m.id === me) && (
                <button onClick={() => removeMember(m.id)} disabled={busy} className="rounded p-1 text-zinc-400 hover:text-red-600" title="Quitar"><X size={14} /></button>
              )}
            </li>
          ))}
        </ul>
        {isOwner && candidates.length > 0 && (
          <select onChange={(e) => { if (e.target.value) addMember(e.target.value); e.target.value = ""; }} defaultValue="" disabled={busy} className={input}>
            <option value="">+ Agregar persona…</option>
            {candidates.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
        )}
        {isOwner && candidates.length === 0 && members.length > 0 && (
          <p className="text-xs text-zinc-500">Ya están todos los del grupo.</p>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isOwner && (
        <button onClick={deleteTrip} disabled={busy} className="flex items-center gap-1 text-xs text-red-600"><Trash2 size={12} /> Borrar viaje</button>
      )}
    </div>
  );
}
