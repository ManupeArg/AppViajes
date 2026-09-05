"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MESSAGES: Record<string, string> = {
  INVITE_INVALID: "Ese código no existe, ya se usó o venció.",
  INVITE_REQUIRED: "Necesitás un código de invitación para crear tu cuenta.",
};

function friendly(msg: string): string {
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k));
  if (key) return MESSAGES[key];
  if (/password should be at least/i.test(msg)) return "La contraseña tiene que tener al menos 6 caracteres.";
  if (/already registered/i.test(msg)) return "Ese email ya tiene cuenta. Dejá el código vacío y entrá con tu contraseña.";
  if (/email not confirmed/i.test(msg)) return "Tenés que confirmar el email antes de entrar (revisá tu casilla).";
  return msg;
}

export function LoginForm({ initialCode = "" }: { initialCode?: string }) {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function withGoogle() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) {
      setError(friendly(error.message));
      setLoading(false);
    }
  }

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const inviteCode = code.trim();

    // 1. Intentar entrar con una cuenta existente.
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (!signIn.error) {
      router.replace(next);
      router.refresh();
      return;
    }

    const invalidCreds = /invalid login credentials/i.test(signIn.error.message);
    if (!invalidCreds) {
      setError(friendly(signIn.error.message));
      setLoading(false);
      return;
    }

    // 2. No existe (o la contraseña está mal). Sin código, no podemos saber cuál de las dos.
    if (!inviteCode) {
      setError("Email o contraseña incorrectos. Si es tu primera vez, pegá el código de invitación.");
      setLoading(false);
      return;
    }

    // 3. Con código: validarlo antes de crear la cuenta.
    const { data: valid } = await supabase.rpc("check_invite", { p_code: inviteCode });
    if (!valid) {
      setError(MESSAGES.INVITE_INVALID);
      setLoading(false);
      return;
    }

    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error) {
      setError(friendly(signUp.error.message));
      setLoading(false);
      return;
    }

    if (!signUp.data.session) {
      // "Confirm email" está activado en Supabase: no hay sesión hasta que confirme.
      // Guardamos el código en cookie para canjearlo cuando vuelva del mail.
      document.cookie = `invite_code=${encodeURIComponent(inviteCode)}; max-age=${60 * 60 * 24 * 7}; path=/; samesite=lax`;
      setNeedsConfirm(true);
      setLoading(false);
      return;
    }

    // 4. Cuenta creada y logueada: canjear el código para crear el perfil.
    const redeem = await supabase.rpc("redeem_invite", { p_code: inviteCode });
    if (redeem.error) {
      setError(friendly(redeem.error.message));
      setLoading(false);
      return;
    }
    document.cookie = "invite_code=; max-age=0; path=/";
    router.replace(next);
    router.refresh();
  }

  const input = "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

  if (needsConfirm) {
    return (
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-300">
        Te mandamos un mail a <b>{email}</b> para confirmar la cuenta. Abrí el link y ya entrás.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={withGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Entrar con Google
      </button>

      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        o con email y contraseña
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form onSubmit={withPassword} className="space-y-2">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vos@email.com"
          className={input}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className={input}
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código de invitación"
          autoCapitalize="off"
          autoCorrect="off"
          className={`${input} font-mono`}
        />
        <p className="text-xs text-zinc-500">
          {code.trim()
            ? "Primera vez: elegí una contraseña (mínimo 6 caracteres) y se crea tu cuenta."
            : "¿Ya tenés cuenta? Dejá el código vacío. ¿Primera vez? Pegá el código que te pasaron."}
        </p>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {loading ? "Un momento…" : code.trim() ? "Crear cuenta y entrar" : "Entrar"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
