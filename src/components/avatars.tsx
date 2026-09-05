"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";

export function Avatar({ profile, size = 24 }: { profile: Profile; size?: number }) {
  const initials = profile.display_name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return profile.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profile.avatar_url}
      alt={profile.display_name}
      width={size}
      height={size}
      className="rounded-full border-2 border-white object-cover dark:border-zinc-900"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid place-items-center rounded-full border-2 border-white font-semibold text-white dark:border-zinc-900"
      style={{ width: size, height: size, background: profile.color, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}

/**
 * Fila de avatares. Cada uno muestra su nombre al pasar el mouse (o al tocarlo en el celular).
 */
export function Avatars({ ids, profiles, size = 24 }: { ids: string[]; profiles: Profile[]; size?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = ids.map((id) => profiles.find((p) => p.id === id)).filter((p): p is Profile => !!p);
  if (list.length === 0) return null;

  return (
    <span className="flex -space-x-1.5">
      {list.map((p) => (
        <span key={p.id} className="group relative inline-flex">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => (o === p.id ? null : p.id)); }}
            onBlur={() => setOpen(null)}
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            aria-label={p.display_name}
          >
            <Avatar profile={p} size={size} />
          </button>
          <span
            className={`pointer-events-none absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg transition-opacity dark:bg-zinc-100 dark:text-zinc-900 ${open === p.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            {p.display_name}
          </span>
        </span>
      ))}
    </span>
  );
}
