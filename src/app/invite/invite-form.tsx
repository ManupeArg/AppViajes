"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MESSAGES: Record<string, string> = {
  INVITE_INVALID: "Ese código no existe, ya se usó o venció.",
  INVITE_REQUIRED: "Necesitás un código para entrar.",
};

export function InviteForm({ initialCode }: { initialCode: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.rpc("redeem_invite", { p_code: code.trim() || null });
    setLoading(false);
    if (error) {
      const key = Object.keys(MESSAGES).find((k) => error.message.includes(k));
      setError(key ? MESSAGES[key] : error.message);
      return;
    }
    document.cookie = "invite_code=; max-age=0; path=/";
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="space-y-3">
    <form onSubmit={submit} className="space-y-3">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ej. 3fa9c1b27e04"
        autoFocus
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-center font-mono text-sm tracking-wider dark:border-zinc-700"
      />
      <button
        disabled={loading}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        Entrar
      </button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </form>
    <form action="/auth/signout" method="post" className="text-center">
      <button className="text-xs text-zinc-400 underline">Salir</button>
    </form>
    </div>
  );
}
