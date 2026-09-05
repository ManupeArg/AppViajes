-- =============================================================================
-- Migración 0002: categorías múltiples + viajes privados con miembros
-- Ejecutar en Supabase: SQL Editor > New query > pegar > Run
-- (es idempotente: se puede correr dos veces sin romper nada)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Categorías múltiples: places.category (enum) -> places.categories (enum[])
-- -----------------------------------------------------------------------------
drop view if exists public.places_overview;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'places' and column_name = 'category') then
    alter table public.places add column categories public.place_category[] not null default '{}';
    update public.places set categories = array[category];
    alter table public.places drop column category;
    drop index if exists public.places_category_idx;
    create index places_categories_idx on public.places using gin (categories);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Viajes privados
-- -----------------------------------------------------------------------------
alter table public.trips add column if not exists is_public boolean not null default false;

create table if not exists public.trip_members (
  trip_id   uuid not null references public.trips (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  added_by  uuid references public.profiles (id) on delete set null,
  added_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table public.trip_members enable row level security;

-- ¿El usuario actual puede ver este viaje? (público, o es creador, o es miembro)
create or replace function public.can_see_trip(p_trip uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.trips t
     where t.id = p_trip
       and (
         t.is_public
         or t.created_by = auth.uid()
         or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid())
       )
  );
$$;

-- ¿Puede ver este lugar?
-- Regla: un lugar es visible salvo que esté ÚNICAMENTE en viajes privados a los que
-- el usuario no pertenece. El creador del lugar siempre lo ve.
create or replace function public.can_see_place(p_place uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (select 1 from public.places p where p.id = p_place and p.created_by = auth.uid())
    or not exists (
      -- está en algún viaje que el usuario NO puede ver…
      select 1 from public.trip_places tp
       where tp.place_id = p_place and not public.can_see_trip(tp.trip_id)
    )
    or exists (
      -- …pero también en alguno que SÍ puede ver
      select 1 from public.trip_places tp
       where tp.place_id = p_place and public.can_see_trip(tp.trip_id)
    );
$$;

grant execute on function public.can_see_trip(uuid), public.can_see_place(uuid) to authenticated;

-- ---- Políticas nuevas ----
drop policy if exists "trips: ver todos" on public.trips;
drop policy if exists "trips: ver visibles" on public.trips;
create policy "trips: ver visibles" on public.trips for select to authenticated
  using (public.is_member() and (created_by = auth.uid() or is_public or public.can_see_trip(id)));

drop policy if exists "places: ver todos" on public.places;
drop policy if exists "places: ver visibles" on public.places;
create policy "places: ver visibles" on public.places for select to authenticated
  using (public.is_member() and (created_by = auth.uid() or public.can_see_place(id)));

drop policy if exists "trip_places: ver" on public.trip_places;
create policy "trip_places: ver" on public.trip_places for select to authenticated
  using (public.is_member() and public.can_see_trip(trip_id));

-- Solo miembros/creador pueden sumar lugares a un viaje (y solo quitan lo que sumaron; el creador quita cualquiera)
drop policy if exists "trip_places: agregar" on public.trip_places;
create policy "trip_places: agregar" on public.trip_places for insert to authenticated
  with check (added_by = auth.uid() and public.is_member() and public.can_see_trip(trip_id));

drop policy if exists "trip_places: quitar" on public.trip_places;
create policy "trip_places: quitar" on public.trip_places for delete to authenticated
  using (added_by = auth.uid() or exists (select 1 from public.trips t where t.id = trip_id and t.created_by = auth.uid()));

-- trip_members: ven la lista quienes ven el viaje; solo el creador agrega; el creador o uno mismo se quita
drop policy if exists "trip_members: ver" on public.trip_members;
create policy "trip_members: ver" on public.trip_members for select to authenticated
  using (public.is_member() and public.can_see_trip(trip_id));
drop policy if exists "trip_members: agregar" on public.trip_members;
create policy "trip_members: agregar" on public.trip_members for insert to authenticated
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.created_by = auth.uid()));
drop policy if exists "trip_members: quitar" on public.trip_members;
create policy "trip_members: quitar" on public.trip_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.trips t where t.id = trip_id and t.created_by = auth.uid()));

-- -----------------------------------------------------------------------------
-- 3. Vista de lugares (recreada con categories y member_ids de viajes)
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
  coalesce(array_agg(distinct v.user_id) filter (where v.user_id is not null), '{}') as visitor_ids,
  coalesce(array_agg(distinct w.user_id) filter (where w.user_id is not null), '{}') as wishlist_ids,
  (select count(*) from public.photos ph where ph.place_id = p.id) as photos_count,
  coalesce((select array_agg(tp.trip_id) from public.trip_places tp where tp.place_id = p.id), '{}') as trip_ids
from public.places p
join public.profiles cp on cp.id = p.created_by
left join public.visits v   on v.place_id = p.id
left join public.wishlist w on w.place_id = p.id
group by p.id, cp.display_name, cp.color;

-- Vista de viajes con sus miembros (para no hacer N queries)
create or replace view public.trips_overview
with (security_invoker = true)
as
select
  t.*,
  coalesce((select array_agg(m.user_id) from public.trip_members m where m.trip_id = t.id), '{}') as member_ids,
  (select count(*) from public.trip_places tp where tp.trip_id = t.id) as places_count
from public.trips t;
