-- =============================================================================
-- Migración 0006: provincia / región de cada lugar (para filtrar)
-- Ejecutar en Supabase: SQL Editor > New query > pegar > Run   (idempotente)
-- =============================================================================

drop view if exists public.places_overview;

alter table public.places add column if not exists region text;
create index if not exists places_region_idx on public.places (country, region);

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

-- El admin puede completar la región de cualquier lugar (botón "Completar provincias")
drop policy if exists "places: admin completa region" on public.places;
create policy "places: admin completa region" on public.places for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
