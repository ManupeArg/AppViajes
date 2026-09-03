import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatars";
import { CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

const VERBS = {
  place_added: "agregó",
  visit: "fue a",
  wishlist: "quiere ir a",
  comment: "comentó en",
  photo: "subió una foto de",
} as const;

export default async function FeedPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const activity = rows ?? [];
  const userIds = [...new Set(activity.map((a) => a.user_id))];
  const placeIds = [...new Set(activity.map((a) => a.place_id).filter((x): x is string => !!x))];
  const visitIds = [...new Set(activity.map((a) => a.visit_id).filter((x): x is string => !!x))];

  const [{ data: profiles }, { data: places }, { data: visits }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("places").select("id,name,category,city").in("id", placeIds.length ? placeIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("visits").select("id,place_id,rating,review").in("id", visitIds.length ? visitIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const prof = new Map((profiles ?? []).map((p) => [p.id, p]));
  const place = new Map((places ?? []).map((p) => [p.id, p]));
  const visit = new Map((visits ?? []).map((v) => [v.id, v]));

  return (
    <main className="mx-auto max-w-xl p-4">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/" className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft size={18} /></Link>
        <h1 className="text-lg font-semibold">Actividad</h1>
        <Link href="/invites" className="ml-auto text-sm text-zinc-500 underline">Invitar amigos</Link>
      </div>

      {activity.length === 0 && <p className="text-sm text-zinc-500">Todavía no pasó nada. ¡Agregá el primer lugar!</p>}

      <ul className="space-y-2">
        {activity.map((a) => {
          const u = prof.get(a.user_id);
          const v = a.visit_id ? visit.get(a.visit_id) : null;
          const p = place.get(a.place_id ?? v?.place_id ?? "");
          if (!u || !p) return null;
          return (
            <li key={a.id} className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <Avatar profile={u} size={36} />
              <div className="min-w-0 flex-1 text-sm">
                <p>
                  <b>{u.display_name}</b> {VERBS[a.kind]}{" "}
                  <Link href={`/p/${p.id}`} className="font-medium underline">
                    {CATEGORIES[p.category].emoji} {p.name}
                  </Link>
                  {p.city && <span className="text-zinc-500"> · {p.city}</span>}
                </p>
                {a.kind === "visit" && v?.rating && (
                  <p className="text-amber-500">{"★".repeat(v.rating)}<span className="text-zinc-300">{"★".repeat(5 - v.rating)}</span></p>
                )}
                {a.kind === "visit" && v?.review && <p className="mt-1 text-zinc-600 dark:text-zinc-300">“{v.review}”</p>}
                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(a.created_at).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
