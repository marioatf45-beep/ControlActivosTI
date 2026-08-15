-- Aislamiento por rol, mensajería privada y auditoría del estado central.

drop policy if exists "messages_visible_with_ticket" on public.ticket_messages;
create policy "messages_visible_to_ticket_participants" on public.ticket_messages
for select to authenticated using (
  exists (
    select 1 from public.tickets t
    join public.profiles p on p.id=auth.uid() and p.active
    where t.id=ticket_messages.ticket_id and (
      public.is_controlti_admin() or t.user_id=auth.uid() or
      (p.role='Tecnico' and t.assigned_user_id=auth.uid())
    )
  )
);

drop policy if exists "participants_create_messages" on public.ticket_messages;
create policy "participants_create_messages" on public.ticket_messages
for insert to authenticated with check (
  author_id=auth.uid() and exists (
    select 1 from public.tickets t
    join public.profiles p on p.id=auth.uid() and p.active
    where t.id=ticket_messages.ticket_id and (
      public.is_controlti_admin() or t.user_id=auth.uid() or
      (p.role='Tecnico' and t.assigned_user_id=auth.uid())
    )
  )
);

create table if not exists public.controlti_state_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  actor_role text not null,
  changed_sections text[] not null default '{}',
  previous_hash text,
  resulting_hash text not null,
  occurred_at timestamptz not null default now()
);
alter table public.controlti_state_audit enable row level security;
revoke all on public.controlti_state_audit from public,anon,authenticated;
grant select on public.controlti_state_audit to authenticated;
drop policy if exists "admins_read_state_audit" on public.controlti_state_audit;
create policy "admins_read_state_audit" on public.controlti_state_audit for select to authenticated
using (public.is_controlti_admin());

drop policy if exists "active_users_read_system_state" on public.controlti_system_state;
revoke select on public.controlti_system_state from authenticated;

create or replace function public.controlti_get_system_state()
returns jsonb language plpgsql security definer set search_path=public as $$
declare profile public.profiles%rowtype; state_data jsonb;
begin
  select * into profile from profiles where id=auth.uid() and active;
  if profile.id is null or profile.role='ServiceDesk' then raise exception 'NOT_AUTHORIZED'; end if;
  select data into state_data from controlti_system_state where singleton=true;
  if state_data is null then return null; end if;
  if profile.role='Administrador' then return state_data; end if;
  return jsonb_build_object(
    'empresa',coalesce(state_data->'empresa','{}'::jsonb),
    'activos',coalesce(state_data->'activos','[]'::jsonb),
    'empleados',coalesce(state_data->'empleados','[]'::jsonb),
    'asignaciones',coalesce(state_data->'asignaciones','[]'::jsonb),
    'unidades',coalesce(state_data->'unidades','[]'::jsonb),
    'mantenimientos',coalesce(state_data->'mantenimientos','[]'::jsonb),
    'movimientos',coalesce(state_data->'movimientos','[]'::jsonb),
    'configuracion',jsonb_build_object(
      'moneda',coalesce(state_data#>'{configuracion,moneda}','"MXN"'::jsonb),
      'mesesMantenimiento',coalesce(state_data#>'{configuracion,mesesMantenimiento}','6'::jsonb),
      'folioAsignacion',coalesce(state_data#>'{configuracion,folioAsignacion}','"RESP"'::jsonb),
      'folioMantenimiento',coalesce(state_data#>'{configuracion,folioMantenimiento}','"MANT"'::jsonb),
      'folioTablet',coalesce(state_data#>'{configuracion,folioTablet}','"RTAB"'::jsonb)
    )
  );
end $$;
revoke all on function public.controlti_get_system_state() from public,anon;
grant execute on function public.controlti_get_system_state() to authenticated;

create or replace function public.controlti_save_system_state(p_data jsonb)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare profile public.profiles%rowtype; saved_at timestamptz:=clock_timestamp(); old_data jsonb; new_data jsonb; allowed text[]; changed text[]; section text;
begin
  select * into profile from profiles where id=auth.uid() and active;
  if profile.id is null or profile.role not in ('Administrador','Inventario','Tecnico') then raise exception 'NOT_AUTHORIZED'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' or pg_column_size(p_data)>10485760 then raise exception 'INVALID_STATE'; end if;
  select data into old_data from controlti_system_state where singleton=true for update;
  if old_data is null and profile.role<>'Administrador' then raise exception 'STATE_NOT_INITIALIZED'; end if;
  if profile.role='Administrador' then
    new_data:=p_data;
    allowed:=array(select jsonb_object_keys(p_data));
  elsif profile.role='Inventario' then
    allowed:=array['activos','empleados','asignaciones','unidades','movimientos']; new_data:=old_data;
  else
    allowed:=array['activos','mantenimientos','movimientos']; new_data:=old_data;
  end if;
  if profile.role<>'Administrador' and old_data is not null then
    foreach section in array allowed loop
      if p_data ? section then new_data:=jsonb_set(new_data,array[section],p_data->section,true); end if;
    end loop;
  end if;
  select coalesce(array_agg(key),'{}') into changed from (
    select key from jsonb_object_keys(new_data) as k(key) where old_data is null or old_data->key is distinct from new_data->key
  ) q;
  insert into controlti_system_state(singleton,data,updated_at,updated_by) values(true,new_data,saved_at,profile.id)
  on conflict(singleton) do update set data=excluded.data,updated_at=saved_at,updated_by=profile.id;
  insert into controlti_state_audit(actor_id,actor_role,changed_sections,previous_hash,resulting_hash,occurred_at)
  values(profile.id,profile.role,changed,case when old_data is null then null else md5(old_data::text) end,md5(new_data::text),saved_at);
  return saved_at;
end $$;
revoke all on function public.controlti_save_system_state(jsonb) from public,anon;
grant execute on function public.controlti_save_system_state(jsonb) to authenticated;
