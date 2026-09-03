"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Visit } from "@/lib/types";

interface Props {
  placeId: string;
  me: string;
  existing?: Visit;
  onDone: () => void;
}

export function VisitForm({ placeId, me, existing, onDone }: Props) {
  const supabase = createClient();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [review, setReview] = useState(existing?.review ?? "");
  const [visitedOn, setVisitedOn] = useState(existing?.visited_on ?? new Date().toISOString().slice(0, 10));
  const [pricePaid, setPricePaid] = useState(existing?.price_paid?.toString() ?? "");
  const [currency, setCurrency] = useState(existing?.currency ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      place_id: placeId,
      user_id: me,
      visited_on: visitedOn,
      rating: rating || null,
      review: review.trim() || null,
      price_paid: pricePaid ? Number(pricePaid) : null,
      currency: currency.trim().toUpperCase() || null,
    };
    const { error } = existing
      ? await supabase.from("visits").update(payload).eq("id", existing.id)
      : await supabase.from("visits").insert(payload);
    setSaving(false);
    if (error) setError(error.message);
    else onDone();
  }

  async function remove() {
    if (!existing) return;
    await supabase.from("visits").delete().eq("id", existing.id);
    onDone();
  }

  const input = "w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/40">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{existing ? "Tu visita" : "¡Fuiste! Contanos"}</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} onClick={() => setRating(n)} className={`text-2xl leading-none ${n <= rating ? "text-amber-500" : "text-zinc-300 dark:text-zinc-600"}`} aria-label={`${n} estrellas`}>★</button>
          ))}
        </div>
      </div>
      <textarea value={review} onChange={(e) => setReview(e.target.value)} placeholder="Reseña (opcional)" rows={3} className={input} />
      <div className="grid grid-cols-3 gap-2">
        <input type="date" value={visitedOn} onChange={(e) => setVisitedOn(e.target.value)} className={input} />
        <input type="number" step="0.01" min="0" value={pricePaid} onChange={(e) => setPricePaid(e.target.value)} placeholder="Pagué" className={input} />
        <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="ARS" maxLength={3} className={input} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={saving} className="flex-1 rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Guardar</button>
        {existing && <button type="button" onClick={remove} className="rounded-lg px-3 py-2 text-sm text-red-600">No fui</button>}
      </div>
    </form>
  );
}
