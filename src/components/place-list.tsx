"use client";

import type { PlaceOverview, Profile } from "@/lib/types";
import { CATEGORIES, PRICE_LABELS } from "@/lib/types";
import { Avatars } from "./avatars";

interface Props {
  places: PlaceOverview[];
  profiles: Profile[];
  me: string;
  onSelect: (id: string) => void;
}

export function PlaceList({ places, profiles, me, onSelect }: Props) {
  if (places.length === 0) {
    return <div className="grid h-full place-items-center p-8 text-center text-sm text-zinc-500">Nada por acá. Probá con otros filtros o agregá un lugar.</div>;
  }

  return (
    <ul className="mx-auto max-w-3xl divide-y divide-zinc-200 overflow-y-auto dark:divide-zinc-800">
      {places.map((p) => {
        const cat = CATEGORIES[p.category];
        const visited = p.visitor_ids.includes(me);
        const wished = p.wishlist_ids.includes(me);
        return (
          <li key={p.id}>
            <button onClick={() => onSelect(p.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white dark:hover:bg-zinc-900">
              <div
                className="grid size-10 shrink-0 place-items-center rounded-full text-lg"
                style={{ background: `${p.created_by_color}22`, border: `2px solid ${p.created_by_color}` }}
              >
                {cat.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  {visited && <span title="Fuiste">✅</span>}
                  {wished && !visited && <span title="Quiero ir">⭐</span>}
                </div>
                <div className="truncate text-sm text-zinc-500">
                  {[p.city, p.country].filter(Boolean).join(", ")} · {cat.label}
                  {p.price_level ? ` · ${PRICE_LABELS[p.price_level]}` : ""}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  <span>por {p.created_by_name}</span>
                  {p.visitors_count > 0 && (
                    <>
                      <span>·</span>
                      <Avatars ids={p.visitor_ids} profiles={profiles} size={18} />
                      <span>{p.visitors_count === 1 ? "fue" : "fueron"}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {p.avg_rating != null ? (
                  <div className="font-semibold">★ {p.avg_rating}</div>
                ) : (
                  <div className="text-sm text-zinc-400">sin puntaje</div>
                )}
                {p.photos_count > 0 && <div className="text-xs text-zinc-400">📷 {p.photos_count}</div>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
