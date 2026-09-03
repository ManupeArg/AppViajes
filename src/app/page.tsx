import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: places }, { data: profiles }, { data: trips }] = await Promise.all([
    supabase.from("places_overview").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("display_name"),
    supabase.from("trips").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <AppShell
      me={user!.id}
      places={places ?? []}
      profiles={profiles ?? []}
      trips={trips ?? []}
    />
  );
}
