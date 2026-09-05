-- =============================================================================
-- Migración 0004: categorías libres (con emoji opcional) + solo miembros agregan a viajes
-- Ejecutar en Supabase: SQL Editor > New query > pegar > Run   (idempotente)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Categorías: de enum fijo a texto libre. Las predefinidas siguen existiendo
--    en el código (comida, bebida, cafe, …); las nuevas viven en custom_categories.
-- -----------------------------------------------------------------------------
drop view if exists public.places_overview;

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'places' and column_name = 'categories' and udt_name = '_place_category'
  ) then
    alter table public.places alter column categories drop default;
    alter table public.places alter column categories type text[] using categories::text[];
    alter table public.places alter column categories set default '{}';
  end if;
end $$;

-- "otro" deja de existir: un lugar sin categoría muestra un pin genérico
update public.places set categories = array_remove(categories, 'otro') where 'otro' = any(categories);

drop type if exists public.place_category;

create table if not exists public.custom_categories (
  name        text primary key,                 -- tal como se muestra, ej. "Estadio"
  emoji       text,                             -- opcional
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (length(name) between 1 and 40)
);

alter table public.custom_categories enable row level security;
drop policy if exists "custom_categories: ver" on public.custom_categories;
drop policy if exists "custom_categories: crear" on public.custom_categories;
drop policy if exists "custom_categories: editar" on public.custom_categories;
drop policy if exists "custom_categories: borrar" on public.custom_categories;
create policy "custom_categories: ver"    on public.custom_categories for select to authenticated using (public.is_member());
create policy "custom_categories: crear"  on public.custom_categories for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy "custom_categories: editar" on public.custom_categories for update to authenticated using (created_by = auth.uid() or public.is_admin());
create policy "custom_categories: borrar" on public.custom_categories for delete to authenticated using (created_by = auth.uid() or public.is_admin());

-- Vista recreada (idéntica, con categories text[])
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

-- -----------------------------------------------------------------------------
-- 2. Solo creador y miembros de un viaje le agregan lugares
-- -----------------------------------------------------------------------------
create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.trips t
     where t.id = p_trip
       and (t.created_by = auth.uid()
            or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid()))
  );
$$;

grant execute on function public.is_trip_member(uuid) to authenticated;

drop policy if exists "trip_places: agregar" on public.trip_places;
create policy "trip_places: agregar" on public.trip_places for insert to authenticated
  with check (added_by = auth.uid() and public.is_member() and public.is_trip_member(trip_id));
