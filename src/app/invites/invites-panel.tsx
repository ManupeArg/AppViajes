"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Invite } from "@/lib/types";

export function InvitesPanel({ invites }: { invites: Invite[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [maxUses, setMaxUses] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);

  async function create() {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("invites").insert({
      created_by: user!.id,
      max_uses: maxUses,
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    });
    router.refresh();
  }

  async function remove(code: string) {
    await supabase.from("invites").delete().eq("code", code);
    router.refresh();
  }

  async function copy(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    if (navigator.share) {
      await navigator.share({ title: "MApp", text: "Entrá a nuestro mapa de lugares:", url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} className="rounded-lg border border-zinc-200 bg-transparent px-2 py-2 text-sm dark:border-zinc-700">
          {[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n} {n === 1 ? "uso" : "usos"}</option>)}
        </select>
        <button onClick={create} className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
          Generar link de invitación
        </button>
      </div>

      <ul className="space-y-2">
        {invites.map((i) => {
          const expired = i.expires_at && new Date(i.expires_at) < new Date();
          const used = i.uses >= i.max_uses;
          return (
            <li key={i.code} className={`flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 ${expired || used ? "opacity-50" : ""}`}>
              <code className="font-mono">{i.code}</code>
              <span className="text-xs text-zinc-500">{i.uses}/{i.max_uses} usos{expired ? " · vencido" : ""}</span>
              <div className="ml-auto flex gap-1">
                {!expired && !used && (
                  <button onClick={() => copy(i.code)} className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Copiar">
                    {copied === i.code ? "✓" : <Copy size={16} />}
                  </button>
                )}
                <button onClick={() => remove(i.code)} className="rounded-lg p-1.5 text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Borrar"><Trash2 size={16} /></button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
