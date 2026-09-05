-- =============================================================================
-- Migración 0005: un lugar que ya existe pero está oculto (viaje privado ajeno)
-- Ejecutar en Supabase: SQL Editor > New query > pegar > Run   (idempotente)
--
-- · Quien tiene un lugar en "quiero ir" o "fui" siempre lo ve.
-- · Si alguien intenta agregar un lugar (por Google Place ID) que ya existe pero
--   no ve, lo "adopta": se le suma a su "quiero ir" y pasa a verlo. No se entera
--   de en qué viaje estaba.
-- =============================================================================

create or replace function public.can_see_place(p_place uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (select 1 from public.places p where p.id = p_place and p.created_by = auth.uid())
    or exists (select 1 from public.wishlist w where w.place_id = p_place and w.user_id = auth.uid())
    or exists (select 1 from public.visits v where v.place_id = p_place and v.user_id = auth.uid())
    or not exists (
      select 1 from public.trip_places tp
       where tp.place_id = p_place and not public.can_see_trip(tp.trip_id)
    )
    or exists (
      select 1 from public.trip_places tp
       where tp.place_id = p_place and public.can_see_trip(tp.trip_id)
    );
$$;

-- Devuelve el id del lugar existente con ese Google Place ID (o null) y lo suma
-- al "quiero ir" del usuario para que pase a verlo.
create or replace function public.adopt_existing_place(p_google_place_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_member() then
    raise exception 'NOT_ALLOWED';
  end if;
  select id into v_id from public.places where google_place_id = p_google_place_id;
  if v_id is null then
    return null;
  end if;
  insert into public.wishlist (place_id, user_id) values (v_id, auth.uid())
    on conflict do nothing;
  return v_id;
end;
$$;

grant execute on function public.adopt_existing_place(text) to authenticated;
