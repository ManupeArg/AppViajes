import { Suspense } from "react";
import { cookies } from "next/headers";
import { LoginForm } from "./login-form";

export default async function LoginPage(props: { searchParams: Promise<{ code?: string }> }) {
  const { code: codeParam } = await props.searchParams;
  const cookieStore = await cookies();
  // El código llega por /invite/<code> (cookie) o por ?code=
  const initialCode = codeParam ?? cookieStore.get("invite_code")?.value ?? "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-1 text-center">
          <div className="text-4xl">🗺️</div>
          <h1 className="text-2xl font-semibold">Mapa de amigos</h1>
          <p className="text-sm text-zinc-500">{initialCode ? "Te invitaron. Creá tu cuenta o entrá con Google." : "Solo con invitación."}</p>
        </div>
        <Suspense>
          <LoginForm initialCode={initialCode} />
        </Suspense>
      </div>
    </main>
  );
}
