import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";

export default async function InvitePage(props: { searchParams: Promise<{ code?: string }> }) {
  const { code: codeParam } = await props.searchParams;
  const cookieStore = await cookies();
  const code = codeParam ?? cookieStore.get("invite_code")?.value ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Primero que se loguee; volvemos acá con el código en la cookie.
    redirect(`/login?next=${encodeURIComponent(`/invite${code ? `?code=${code}` : ""}`)}`);
  }

  const { data: isMember } = await supabase.rpc("is_member");
  if (isMember) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-1 text-center">
          <div className="text-4xl">🎟️</div>
          <h1 className="text-2xl font-semibold">Código de invitación</h1>
          <p className="text-sm text-zinc-500">
            Hola {user.user_metadata?.full_name ?? user.email}. Pedile un código a quien te invitó.
          </p>
        </div>
        <InviteForm initialCode={code} />
      </div>
    </main>
  );
}
