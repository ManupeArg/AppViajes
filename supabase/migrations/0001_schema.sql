-- =============================================================================
-- Mapa de Amigos — esquema inicial
-- Ejecutar en Supabase: SQL Editor > New query > pegar > Run
-- (o con `supabase db push` si usás la CLI)
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.place_category as enum (
  'comida', 'bebida', 'cafe', 'super', 'compras', 'alojamiento',
  'atraccion', 'naturaleza', 'vida_nocturna', 'transporte', 'otro'
);

create type public.activity_kind as enum ('place_added', 'visit', 'wishlist', 'comment', 'photo');

-- -----------------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url  text,
  color       text not null default '#3b82f6',  -- color del usuario en el mapa
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Invitaciones: registro cerrado por código
-- -----------------------------------------------------------------------------
create table public.invites (
  code        text primary key default encode(gen_random_bytes(6), 'hex'),
  created_by  uuid references public.profiles (id) on delete set null,
  max_uses    int not null default 1,
  uses        int not null default 0,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (uses <= max_uses)
);

-- Flujo de acceso:
--   1. La persona se autentica (Google o magic link). Eso crea auth.users pero NO un perfil.
--   2. Sin perfil, las políticas RLS no dejan ver nada (ver is_member() abajo).
--   3. La app la manda a /invite; ahí canjea el código con redeem_invite(), que crea el perfil.
--   4. El primer usuario de la base (profiles vacía) entra sin código: sos vos.

-- ¿El usuario actual es un amigo con perfil?
create or replace function public.is_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

grant execute on function public.is_member() to authenticated;

-- Canjea un código y crea el perfil del usuario autenticado.
create or replace function public.redeem_invite(p_code text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_user  auth.users%rowtype;
  v_first boolean;
  v_prof  public.profiles;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_prof from public.profiles where id = v_uid;
  if found then
    return v_prof;  -- ya era miembro
  end if;

  select not exists (select 1 from public.profiles) into v_first;

  if not v_first then
    if p_code is null then
      raise exception 'INVITE_REQUIRED';
    end if;

    update public.invites
       set uses = uses + 1
     where code = p_code
       and uses < max_uses
       and (expires_at is null or expires_at > now());

    if not found then
      raise exception 'INVITE_INVALID';
    end if;
  end if;

  select * into v_user from auth.users where id = v_uid;

  insert into public.profiles (id, display_name, avatar_url)
  values (
    v_uid,
    coalesce(
      v_user.raw_user_meta_data ->> 'full_name',
      v_user.raw_user_meta_data ->> 'name',
      split_part(v_user.email, '@', 1)
    ),
    v_user.raw_user_meta_data ->> 'avatar_url'
  )
  returning * into v_prof;

  return v_prof;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated;

-- Validación previa desde el frontend (sin exponer la tabla invites).
create or replace function public.check_invite(p_code text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.invites
     where code = p_code
       and uses < max_uses
       and (expires_at is null or expires_at > now())
  );
$$;

grant execute on function public.check_invite(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Viajes ("Viaje a Japón 2026")
-- -----------------------------------------------------------------------------
create table public.trips (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  starts_on   date,
  ends_on     date,
  emoji       text default '✈️',
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Lugares
-- -----------------------------------------------------------------------------
create table public.places (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  category        public.place_category not null default 'otro',
  lat             double precision not null check (lat between -90 and 90),
  lng             double precision not null check (lng between -180 and 180),
  address         text,
  city            text,
  country         text,
  country_code    char(2),
  price_level     smallint check (price_level between 1 and 4),  -- $ a $$$$
  google_place_id text unique,
  website         text,
  notes           text,
  tags            text[] not null default '{}',
  created_by      uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index places_city_idx    on public.places (country, city);
create index places_category_idx on public.places (category);
create index places_created_by_idx on public.places (created_by);

-- Lugar <-> viaje (N:M)
create table public.trip_places (
  trip_id   uuid not null references public.trips (id) on delete cascade,
  place_id  uuid not null references public.places (id) on delete cascade,
  added_by  uuid not null references public.profiles (id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (trip_id, place_id)
);

-- -----------------------------------------------------------------------------
-- Visitas ("fui"): de acá salen el puntaje y "quiénes fueron"
-- -----------------------------------------------------------------------------
create table public.visits (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references public.places (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  visited_on  date not null default current_date,
  rating      smallint check (rating between 1 and 5),
  review      text,
  price_paid  numeric(10, 2),
  currency    char(3),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (place_id, user_id, visited_on)
);

create index visits_place_idx on public.visits (place_id);
create index visits_user_idx  on public.visits (user_id);

-- -----------------------------------------------------------------------------
-- Wishlist ("quiero ir")
-- -----------------------------------------------------------------------------
create table public.wishlist (
  place_id    uuid not null references public.places (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now(),
  primary key (place_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Fotos (archivos en Storage bucket "photos", acá solo la referencia)
-- -----------------------------------------------------------------------------
create table public.photos (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references public.places (id) on delete cascade,
  visit_id    uuid references public.visits (id) on delete set null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,   -- ej: "<place_id>/<uuid>.jpg" dentro del bucket photos
  caption     text,
  created_at  timestamptz not null default now()
);

create index photos_place_idx on public.photos (place_id);

-- -----------------------------------------------------------------------------
-- Comentarios y reacciones sobre visitas/reseñas
-- -----------------------------------------------------------------------------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid not null references public.visits (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index comments_visit_idx on public.comments (visit_id);

create table public.reactions (
  visit_id    uuid not null references public.visits (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  emoji       text not null check (length(emoji) <= 8),
  created_at  timestamptz not null default now(),
  primary key (visit_id, user_id, emoji)
);

-- -----------------------------------------------------------------------------
-- Feed de actividad (tabla materializada por triggers, más simple de paginar)
-- -----------------------------------------------------------------------------
create table public.activity (
  id          bigint generated always as identity primary key,
  kind        public.activity_kind not null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  place_id    uuid references public.places (id) on delete cascade,
  visit_id    uuid references public.visits (id) on delete cascade,
  comment_id  uuid references public.comments (id) on delete cascade,
  photo_id    uuid references public.photos (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index activity_created_idx on public.activity (created_at desc);

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'places' then
    insert into activity (kind, user_id, place_id) values ('place_added', new.created_by, new.id);
  elsif tg_table_name = 'visits' then
    insert into activity (kind, user_id, place_id, visit_id) values ('visit', new.user_id, new.place_id, new.id);
  elsif tg_table_name = 'wishlist' then
    insert into activity (kind, user_id, place_id) values ('wishlist', new.user_id, new.place_id);
  elsif tg_table_name = 'comments' then
    insert into activity (kind, user_id, visit_id, comment_id) values ('comment', new.user_id, new.visit_id, new.id);
  elsif tg_table_name = 'photos' then
    insert into activity (kind, user_id, place_id, photo_id) values ('photo', new.user_id, new.place_id, new.id);
  end if;
  return new;
end;
$$;

create trigger places_activity   after insert on public.places   for each row execute function public.log_activity();
create trigger visits_activity   after insert on public.visits   for each row execute function public.log_activity();
create trigger wishlist_activity after insert on public.wishlist for each row execute function public.log_activity();
create trigger comments_activity after insert on public.comments for each row execute function public.log_activity();
create trigger photos_activity   after insert on public.photos   for each row execute function public.log_activity();

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger places_touch before update on public.places for each row execute function public.touch_updated_at();
create trigger visits_touch before update on public.visits for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Vista de lugares con agregados (puntaje promedio, quiénes fueron, etc.)
-- Es lo que consume el mapa y la lista.
-- -----------------------------------------------------------------------------
create or replace view public.places_overview
with (security_invoker = true)
as
select
  p.*,
  cp.display_name                                   as created_by_name,
  cp.color                                          as created_by_color,
  round(avg(v.rating)::numeric, 1)                  as avg_rating,
  count(distinct v.user_id)                         as visitors_count,
  coalesce(
    array_agg(distinct v.user_id) filter (where v.user_id is not null), '{}'
  )                                                 as visitor_ids,
  coalesce(
    array_agg(distinct w.user_id) filter (where w.user_id is not null), '{}'
  )                                                 as wishlist_ids,
  (select count(*) from public.photos ph where ph.place_id = p.id) as photos_count,
  coalesce(
    (select array_agg(tp.trip_id) from public.trip_places tp where tp.place_id = p.id), '{}'
  )                                                 as trip_ids
from public.places p
join public.profiles cp on cp.id = p.created_by
left join public.visits v   on v.place_id = p.id
left join public.wishlist w on w.place_id = p.id
group by p.id, cp.display_name, cp.color;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- Regla general: cualquier miembro (autenticado + con perfil, ver is_member()) ve todo;
-- cada uno edita/borra solo lo suyo.
-- -----------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.invites     enable row level security;
alter table public.trips       enable row level security;
alter table public.places      enable row level security;
alter table public.trip_places enable row level security;
alter table public.visits      enable row level security;
alter table public.wishlist    enable row level security;
alter table public.photos      enable row level security;
alter table public.comments    enable row level security;
alter table public.reactions   enable row level security;
alter table public.activity    enable row level security;

-- profiles
create policy "profiles: ver todos"    on public.profiles for select to authenticated using (public.is_member());
create policy "profiles: editar propio" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- invites: cualquier amigo puede generar y ver los códigos que creó
create policy "invites: ver propios"  on public.invites for select to authenticated using (created_by = auth.uid());
create policy "invites: crear"        on public.invites for insert to authenticated with check (created_by = auth.uid() and public.is_member());
create policy "invites: borrar propios" on public.invites for delete to authenticated using (created_by = auth.uid());

-- trips
create policy "trips: ver todos"   on public.trips for select to authenticated using (public.is_member());
create policy "trips: crear"       on public.trips for insert to authenticated with check (created_by = auth.uid() and public.is_member());
create policy "trips: editar propio" on public.trips for update to authenticated using (created_by = auth.uid());
create policy "trips: borrar propio" on public.trips for delete to authenticated using (created_by = auth.uid());

-- places
create policy "places: ver todos"    on public.places for select to authenticated using (public.is_member());
create policy "places: crear"        on public.places for insert to authenticated with check (created_by = auth.uid() and public.is_member());
create policy "places: editar propio" on public.places for update to authenticated using (created_by = auth.uid());
create policy "places: borrar propio" on public.places for delete to authenticated using (created_by = auth.uid());

-- trip_places: cualquiera suma lugares a cualquier viaje; solo quita lo que sumó
create policy "trip_places: ver"     on public.trip_places for select to authenticated using (public.is_member());
create policy "trip_places: agregar" on public.trip_places for insert to authenticated with check (added_by = auth.uid() and public.is_member());
create policy "trip_places: quitar"  on public.trip_places for delete to authenticated using (added_by = auth.uid());

-- visits
create policy "visits: ver todas"    on public.visits for select to authenticated using (public.is_member());
create policy "visits: crear"        on public.visits for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "visits: editar propia" on public.visits for update to authenticated using (user_id = auth.uid());
create policy "visits: borrar propia" on public.visits for delete to authenticated using (user_id = auth.uid());

-- wishlist
create policy "wishlist: ver"    on public.wishlist for select to authenticated using (public.is_member());
create policy "wishlist: crear"  on public.wishlist for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "wishlist: borrar" on public.wishlist for delete to authenticated using (user_id = auth.uid());

-- photos
create policy "photos: ver"    on public.photos for select to authenticated using (public.is_member());
create policy "photos: crear"  on public.photos for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "photos: borrar" on public.photos for delete to authenticated using (user_id = auth.uid());

-- comments
create policy "comments: ver"    on public.comments for select to authenticated using (public.is_member());
create policy "comments: crear"  on public.comments for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "comments: borrar" on public.comments for delete to authenticated using (user_id = auth.uid());

-- reactions
create policy "reactions: ver"    on public.reactions for select to authenticated using (public.is_member());
create policy "reactions: crear"  on public.reactions for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy "reactions: borrar" on public.reactions for delete to authenticated using (user_id = auth.uid());

-- activity: solo lectura (la escriben los triggers)
create policy "activity: ver" on public.activity for select to authenticated using (public.is_member());

-- -----------------------------------------------------------------------------
-- Storage: bucket de fotos (privado; se sirven con URLs firmadas)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "photos bucket: ver"    on storage.objects for select to authenticated using (bucket_id = 'photos' and public.is_member());
create policy "photos bucket: subir"  on storage.objects for insert to authenticated with check (bucket_id = 'photos' and owner = auth.uid() and public.is_member());
create policy "photos bucket: borrar" on storage.objects for delete to authenticated using (bucket_id = 'photos' and owner = auth.uid());
