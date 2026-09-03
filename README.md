# 🗺️ Mapa de amigos

Web privada para un grupo de amigos: mapa mundial de lugares (comida, bebida, súper, atracciones…) con precio, puntaje, reseñas, "fui" / "quiero ir", viajes, feed de actividad y acceso solo por invitación.

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Auth + Storage + RLS) · MapLibre GL · Tailwind 4 · PWA. Se hostea gratis en Vercel.

---

## Setup (≈ 30 minutos)

### 1. Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com) (plan gratis alcanza).
2. **SQL Editor → New query**, pegá el contenido de `supabase/migrations/0001_schema.sql` y ejecutalo. Crea todas las tablas, políticas RLS, funciones y el bucket de fotos.
3. **Authentication → Providers:**
   - **Email:** dejalo habilitado. Para que funcione con magic link, desactivá "Confirm email" o dejalo, ambos funcionan.
   - **Google:** habilitalo. Necesitás un OAuth Client ID de Google Cloud Console (tipo "Web application"). En *Authorized redirect URIs* poné la URL que te muestra Supabase (`https://<ref>.supabase.co/auth/v1/callback`).
4. **Authentication → URL Configuration:**
   - *Site URL:* `http://localhost:3000` (después la cambiás por tu dominio de Vercel).
   - *Redirect URLs:* agregá `http://localhost:3000/**` y más adelante `https://tu-app.vercel.app/**`.
5. **Project Settings → API:** copiá la *Project URL* y la *anon public key*.

### 2. Proyecto local

```bash
cp .env.example .env.local   # completá las dos variables de Supabase
npm install
npm run dev
```

Abrí http://localhost:3000, entrá con Google o con tu email. **El primer usuario que entra no necesita código de invitación** (sos vos). Los demás sí.

### 3. Invitar amigos

Desde la app: ícono de actividad → *Invitar amigos* → *Generar link*. Te da un link tipo `https://tu-app/invite/3fa9c1b27e04` que mandás por WhatsApp. Quien lo abre se loguea (Google o email) y queda adentro. Cada código sirve 1 vez por defecto (podés elegir 3, 5 o 10) y vence a los 7 días.

### 4. Deploy en Vercel

1. Subí el repo a GitHub.
2. En [vercel.com](https://vercel.com) → *New Project* → importá el repo. Detecta Next.js solo.
3. En *Environment Variables* cargá las mismas del `.env.local`.
4. Deploy. Después actualizá *Site URL* y *Redirect URLs* en Supabase con tu dominio de Vercel.

### 5. Opcionales que mejoran mucho

| Variable | Qué hace | Dónde sacarla |
|---|---|---|
| `NEXT_PUBLIC_MAPTILER_KEY` | Mapa base lindo (calles, edificios, modo claro/oscuro). Sin esto se usa OSM crudo. | [cloud.maptiler.com](https://cloud.maptiler.com) → gratis hasta 100k tiles/mes |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Buscador de lugares con datos de Google (nombres, direcciones, precio). Sin esto se usa Nominatim/OSM, que funciona pero encuentra menos locales. | Google Cloud Console → habilitar **Places API (New)** → crear API key → restringirla por *HTTP referrers* a tu dominio |

Para Google Places hay que cargar tarjeta, pero el crédito gratuito mensual sobra para un grupo de amigos. Restringí la key al dominio sí o sí.

---

## Cómo está armado

```
supabase/migrations/0001_schema.sql   ← toda la base: tablas, RLS, funciones, triggers, storage
src/
  proxy.ts                            ← middleware: refresca sesión, redirige a /login o /invite
  lib/
    supabase/{client,server,middleware}.ts
    types.ts                          ← tipos de la DB + categorías/íconos
    filters.ts                        ← filtros y orden (compartidos entre mapa y lista, viven en la URL)
    places-search.ts                  ← búsqueda de lugares (Google Places o Nominatim)
  app/
    page.tsx                          ← home: trae datos y renderiza AppShell
    login/                            ← Google + magic link
    invite/                           ← canje de código (/invite/<code> guarda cookie)
    invites/                          ← generar y compartir links de invitación
    feed/                             ← actividad del grupo
    p/[id]/                           ← link compartible de un lugar
    auth/callback, auth/signout
    manifest.ts                       ← PWA
  components/
    app-shell.tsx                     ← header, tabs mapa/lista, diálogos
    place-map.tsx                     ← MapLibre + clusters (supercluster)
    place-list.tsx
    filter-bar.tsx
    place-sheet.tsx                   ← detalle: cómo llegar, compartir, fui, quiero ir, viajes, reseñas
    visit-form.tsx                    ← puntaje, reseña, fecha, lo que pagaste
    add-place-dialog.tsx              ← buscar → categoría → precio → notas → viaje
    trips-dialog.tsx
public/sw.js                          ← service worker: cachea tiles y estáticos
public/maplibre/                      ← worker de MapLibre (se copia solo en `npm install`, ver scripts/)
```

> **Nota técnica:** Next 16 (Turbopack) resuelve mal la URL del web worker de MapLibre, y sin ese worker
> el mapa vectorial queda vacío. Por eso `scripts/copy-maplibre-worker.mjs` copia el worker a `public/maplibre/`
> en cada `npm install` y `place-map.tsx` llama a `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")`.

### Modelo de datos (resumen)

- `profiles` — un amigo. Tiene color propio que se usa en los marcadores.
- `invites` — códigos de invitación.
- `places` — un lugar. Quien lo carga es `created_by`.
- `visits` — "fui": una por persona por lugar por fecha, con puntaje 1-5, reseña y precio pagado. **El puntaje del lugar es el promedio de las visitas** y "quiénes fueron" sale de acá.
- `wishlist` — "quiero ir".
- `trips` + `trip_places` — viajes ("Japón 2026") y qué lugares tienen.
- `photos`, `comments`, `reactions` — tablas listas, UI pendiente.
- `activity` — feed, lo llenan triggers automáticamente.
- `places_overview` — vista que junta todo lo anterior por lugar; es lo que consumen el mapa y la lista.

### Seguridad

Todo está protegido por Row Level Security en Postgres. Un usuario autenticado que no canjeó invitación **no ve nada** (`is_member()` devuelve false). Cualquier miembro ve todo; cada uno edita y borra solo lo propio. La anon key de Supabase puede ser pública sin problema: no permite nada que RLS no permita.

### Regenerar tipos

Cuando cambies el esquema:

```bash
npx supabase gen types typescript --project-id <tu-project-ref> > src/lib/types.ts
```

y volvé a pegar al final los helpers `CATEGORIES` y `PRICE_LABELS`.

---

## Pendientes (ya tienen tabla y RLS, falta la UI)

- **Fotos:** subir a bucket `photos` (path `<place_id>/<uuid>.jpg`), insertar en `photos`, mostrar con URLs firmadas.
- **Comentarios y reacciones** sobre reseñas: tablas `comments` y `reactions`.
- **Distancia a mi ubicación** como orden en la lista (el mapa ya tiene botón de geolocalización).
- Editar lugar (nombre, categoría, notas) desde el detalle.
