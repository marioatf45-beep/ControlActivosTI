-- Inventario central compartido entre navegadores.
create table if not exists public.controlti_assets (
  external_id text primary key,
  data jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.controlti_assets enable row level security;
revoke all on public.controlti_assets from anon;
grant select on public.controlti_assets to authenticated;
drop policy if exists "active_users_read_assets" on public.controlti_assets;
create policy "active_users_read_assets" on public.controlti_assets for select to authenticated
using (active and exists (select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role <> 'ServiceDesk'));

create or replace function public.controlti_sync_assets(p_assets jsonb, p_removed_ids text[] default '{}')
returns integer language plpgsql security definer set search_path=public as $$
declare item jsonb; affected integer := 0; item_id text;
begin
  if not exists (select 1 from profiles where id=auth.uid() and active and role in ('Administrador','Inventario','Tecnico')) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if jsonb_typeof(p_assets) <> 'array' or jsonb_array_length(p_assets) > 10000 then raise exception 'INVALID_ASSETS'; end if;
  for item in select * from jsonb_array_elements(p_assets) loop
    item_id := nullif(trim(item->>'id'),'');
    if item_id is null then continue; end if;
    insert into controlti_assets(external_id,data,active,updated_at,updated_by)
    values(item_id,item,true,now(),auth.uid())
    on conflict(external_id) do update set data=excluded.data,active=true,updated_at=now(),updated_by=auth.uid();
    affected := affected + 1;
  end loop;
  if coalesce(array_length(p_removed_ids,1),0)>0 then
    update controlti_assets set active=false,updated_at=now(),updated_by=auth.uid() where external_id=any(p_removed_ids);
  end if;
  return affected;
end $$;
revoke all on function public.controlti_sync_assets(jsonb,text[]) from public,anon;
grant execute on function public.controlti_sync_assets(jsonb,text[]) to authenticated;

-- Estado operativo completo para módulos que conservan una API sincrónica en el navegador.
create table if not exists public.controlti_system_state (
  singleton boolean primary key default true check (singleton),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.controlti_system_state enable row level security;
revoke all on public.controlti_system_state from anon;
grant select on public.controlti_system_state to authenticated;
drop policy if exists "active_users_read_system_state" on public.controlti_system_state;
create policy "active_users_read_system_state" on public.controlti_system_state for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role <> 'ServiceDesk'));

create or replace function public.controlti_save_system_state(p_data jsonb)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare saved_at timestamptz := clock_timestamp();
begin
  if not exists (select 1 from profiles where id=auth.uid() and active and role in ('Administrador','Inventario','Tecnico')) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 10485760 then
    raise exception 'INVALID_STATE';
  end if;
  insert into controlti_system_state(singleton,data,updated_at,updated_by)
  values(true,p_data,saved_at,auth.uid())
  on conflict(singleton) do update set data=excluded.data,updated_at=saved_at,updated_by=auth.uid();
  return saved_at;
end $$;
revoke all on function public.controlti_save_system_state(jsonb) from public,anon;
grant execute on function public.controlti_save_system_state(jsonb) to authenticated;
