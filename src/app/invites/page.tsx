import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InvitesPanel } from "./invites-panel";
import { BackfillRegions } from "./backfill-regions";

export const dynamic = "force-dynamic";

export default async function InvitesPage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/feed");
  const { data: invites } = await supabase.from("invites").select("*").order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-xl p-4">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/" className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft size={18} /></Link>
        <h1 className="text-lg font-semibold">Invitar amigos</h1>
      </div>
      <p className="mb-4 text-sm text-zinc-500">Generá un link y mandáselo. Cada código sirve una vez (o las veces que elijas) y vence a los 7 días.</p>
      <InvitesPanel invites={invites ?? []} />
      <BackfillRegions />
    </main>
  );
}
