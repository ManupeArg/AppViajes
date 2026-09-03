import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// En Next.js 16 el middleware se llama "proxy". Refresca la sesión de Supabase
// y redirige a /login si no hay usuario.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo salvo estáticos: Next, imágenes, iconos PWA, service worker, worker de MapLibre
    "/((?!_next/static|_next/image|favicon.ico|icons/|maplibre/|sw.js|manifest.webmanifest|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs)$).*)",
  ],
};
