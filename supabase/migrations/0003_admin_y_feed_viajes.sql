-- =============================================================================
-- Migración 0003: admin (invitaciones) + actividad de viajes en el feed
-- Ejecutar en Supabase: SQL Editor > New query > pegar > Run   (idempotente)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Admin
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Manuel es admin. Si por algún motivo ese email no tiene perfil, el primer usuario lo es.
update public.profiles p set is_admin = true
  from auth.users u
 where u.id = p.id and lower(u.email) = 'penamanuel628@gmail.com';

update public.profiles set is_admin = true
 where not exists (select 1 from public.profiles where is_admin)
   and id = (select id from public.profiles order by created_at limit 1);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated;

-- Solo el admin crea / ve / borra invitaciones
drop policy if exists "invites: ver propios" on public.invites;
drop policy if exists "invites: crear" on public.invites;
drop policy if exists "invites: borrar propios" on public.invites;
drop policy if exists "invites: ver (admin)" on public.invites;
drop policy if exists "invites: crear (admin)" on public.invites;
drop policy if exists "invites: borrar (admin)" on public.invites;
create policy "invites: ver (admin)"    on public.invites for select to authenticated using (public.is_admin());
create policy "invites: crear (admin)"  on public.invites for insert to authenticated with check (created_by = auth.uid() and public.is_admin());
create policy "invites: borrar (admin)" on public.invites for delete to authenticated using (public.is_admin());

-- El admin ve todos los viajes (privados incluidos) y por lo tanto sus lugares
create or replace function public.can_see_trip(p_trip uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin() or exists (
    select 1 from public.trips t
     where t.id = p_trip
       and (
         t.is_public
         or t.created_by = auth.uid()
         or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid())
       )
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Actividad de viajes
-- -----------------------------------------------------------------------------
alter type public.activity_kind add value if not exists 'trip_created';
alter type public.activity_kind add value if not exists 'trip_place_added';

alter table public.activity add column if not exists trip_id uuid references public.trips (id) on delete cascade;

create or replace function public.log_trip_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'trips' then
    insert into activity (kind, user_id, trip_id) values ('trip_created', new.created_by, new.id);
  elsif tg_table_name = 'trip_places' then
    insert into activity (kind, user_id, trip_id, place_id) values ('trip_place_added', new.added_by, new.trip_id, new.place_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trips_activity on public.trips;
create trigger trips_activity after insert on public.trips for each row execute function public.log_trip_activity();
drop trigger if exists trip_places_activity on public.trip_places;
create trigger trip_places_activity after insert on public.trip_places for each row execute function public.log_trip_activity();

-- Quién ve qué en el feed:
--   · actividad sin viaje: todos los miembros
--   · actividad de un viaje público: todos
--   · actividad de un viaje privado: solo el admin
drop policy if exists "activity: ver" on public.activity;
create policy "activity: ver" on public.activity for select to authenticated
  using (
    public.is_member() and (
      trip_id is null
      or public.is_admin()
      or exists (select 1 from public.trips t where t.id = trip_id and t.is_public)
    )
  );
