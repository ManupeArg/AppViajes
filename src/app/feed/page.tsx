import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatars";
import { placeEmoji } from "@/lib/types";

export const dynamic = "force-dynamic";

const NONE = ["00000000-0000-0000-0000-000000000000"];

export default async function FeedPage() {
  const supabase = await createClient();
  const [{ data: rows }, { data: isAdmin }] = await Promise.all([
    supabase.from("activity").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.rpc("is_admin"),
  ]);

  const activity = rows ?? [];
  const ids = (k: "user_id" | "place_id" | "visit_id" | "trip_id") =>
    [...new Set(activity.map((a) => a[k]).filter((x): x is string => !!x))];

  const [{ data: profiles }, { data: places }, { data: visits }, { data: trips }, { data: customs }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", ids("user_id").length ? ids("user_id") : NONE),
    supabase.from("places").select("id,name,categories,city").in("id", ids("place_id").length ? ids("place_id") : NONE),
    supabase.from("visits").select("id,place_id,rating,review").in("id", ids("visit_id").length ? ids("visit_id") : NONE),
    supabase.from("trips").select("id,name,emoji,is_public").in("id", ids("trip_id").length ? ids("trip_id") : NONE),
    supabase.from("custom_categories").select("*"),
  ]);
  const cc = customs ?? [];

  const prof = new Map((profiles ?? []).map((p) => [p.id, p]));
  const place = new Map((places ?? []).map((p) => [p.id, p]));
  const visit = new Map((visits ?? []).map((v) => [v.id, v]));
  const trip = new Map((trips ?? []).map((t) => [t.id, t]));

  return (
    <main className="mx-auto max-w-xl p-4">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/" className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft size={18} /></Link>
        <h1 className="text-lg font-semibold">Actividad</h1>
        <div className="ml-auto flex items-center gap-3">
          {isAdmin && <Link href="/invites" className="text-sm text-zinc-500 underline">Invitar amigos</Link>}
          <form action="/auth/signout" method="post">
            <button className="flex items-center gap-1 text-sm text-zinc-500 hover:text-red-600"><LogOut size={14} /> Salir</button>
          </form>
        </div>
      </div>

      {activity.length === 0 && <p className="text-sm text-zinc-500">Todavía no pasó nada. ¡Agregá el primer lugar!</p>}

      <ul className="space-y-2">
        {activity.map((a) => {
          const u = prof.get(a.user_id);
          if (!u) return null;
          const v = a.visit_id ? visit.get(a.visit_id) : null;
          const p = place.get(a.place_id ?? v?.place_id ?? "");
          const t = a.trip_id ? trip.get(a.trip_id) : null;

          let body: React.ReactNode = null;
          if (a.kind === "trip_created") {
            if (!t) return null;
            body = <>creó el viaje <Link href={`/?trip=${t.id}`} className="font-medium underline">{t.emoji} {t.name}</Link>{!t.is_public && " 🔒"}</>;
          } else if (a.kind === "trip_place_added") {
            if (!t || !p) return null;
            body = (
              <>
                agregó <Link href={`/p/${p.id}`} className="font-medium underline">{placeEmoji(p.categories, cc)} {p.name}</Link>
                {" "}al viaje <Link href={`/?trip=${t.id}`} className="font-medium underline">{t.emoji} {t.name}</Link>{!t.is_public && " 🔒"}
              </>
            );
          } else {
            if (!p) return null;
            const verb = { place_added: "agregó", visit: "fue a", wishlist: "quiere ir a", comment: "comentó en", photo: "subió una foto de" }[a.kind];
            body = (
              <>
                {verb} <Link href={`/p/${p.id}`} className="font-medium underline">{placeEmoji(p.categories, cc)} {p.name}</Link>
                {p.city && <span className="text-zinc-500"> · {p.city}</span>}
              </>
            );
          }

          return (
            <li key={a.id} className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <Avatar profile={u} size={36} />
              <div className="min-w-0 flex-1 text-sm">
                <p><b>{u.display_name}</b> {body}</p>
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
