import { NextResponse } from "next/server";

// /invite/<code> → guarda el código en una cookie y manda a /invite.
// Así el link se puede abrir antes de estar logueado y el código sobrevive al login.
export async function GET(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const res = NextResponse.redirect(new URL(`/invite?code=${encodeURIComponent(code)}`, request.url));
  res.cookies.set("invite_code", code, { path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
  return res;
}
