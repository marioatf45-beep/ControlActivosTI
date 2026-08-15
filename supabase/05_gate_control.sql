-- Entradas y salidas de laptops. Ejecutar después de 04_service_role_profile_fix.sql.
create table if not exists public.controlti_gate_assets (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  asset_number text not null,
  serial_number text not null default '',
  brand text not null default '',
  model text not null default '',
  assigned_to text not null default '',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create unique index if not exists controlti_gate_asset_number_ci on public.controlti_gate_assets (lower(asset_number));
create unique index if not exists controlti_gate_serial_ci on public.controlti_gate_assets (lower(serial_number)) where serial_number <> '';

create table if not exists public.controlti_gate_state (
  asset_id uuid primary key references public.controlti_gate_assets(id) on delete cascade,
  location text not null default 'DENTRO' check (location in ('DENTRO','FUERA')),
  last_event_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.controlti_gate_events (
  id bigint generated always as identity primary key,
  asset_id uuid not null references public.controlti_gate_assets(id),
  direction text not null check (direction in ('ENTRADA','SALIDA')),
  asset_number text not null,
  serial_number text not null default '',
  brand text not null default '',
  model text not null default '',
  assigned_to text not null default '',
  recorded_by uuid not null references auth.users(id),
  recorded_by_name text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists controlti_gate_events_recent on public.controlti_gate_events (occurred_at desc);
create index if not exists controlti_gate_events_asset on public.controlti_gate_events (asset_id, occurred_at desc);

alter table public.controlti_gate_assets enable row level security;
alter table public.controlti_gate_state enable row level security;
alter table public.controlti_gate_events enable row level security;
revoke all on public.controlti_gate_assets, public.controlti_gate_state, public.controlti_gate_events from anon;
grant select on public.controlti_gate_assets, public.controlti_gate_state, public.controlti_gate_events to authenticated;

create policy "active_users_read_gate_assets" on public.controlti_gate_assets for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role <> 'ServiceDesk'));
create policy "active_users_read_gate_state" on public.controlti_gate_state for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role <> 'ServiceDesk'));
create policy "active_users_read_gate_events" on public.controlti_gate_events for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role <> 'ServiceDesk'));

create or replace function public.controlti_sync_gate_assets(p_assets jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare item jsonb; affected integer := 0;
begin
  if not exists (select 1 from profiles where id=auth.uid() and active and role in ('Administrador','Inventario')) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if jsonb_typeof(p_assets) <> 'array' or jsonb_array_length(p_assets) > 5000 then raise exception 'INVALID_ASSETS'; end if;
  for item in select * from jsonb_array_elements(p_assets) loop
    if nullif(trim(item->>'external_id'),'') is null or nullif(trim(item->>'asset_number'),'') is null then continue; end if;
    insert into controlti_gate_assets(external_id,asset_number,serial_number,brand,model,assigned_to,updated_at)
    values(trim(item->>'external_id'),trim(item->>'asset_number'),trim(coalesce(item->>'serial_number','')),trim(coalesce(item->>'brand','')),trim(coalesce(item->>'model','')),trim(coalesce(item->>'assigned_to','')),now())
    on conflict(external_id) do update set asset_number=excluded.asset_number,serial_number=excluded.serial_number,brand=excluded.brand,model=excluded.model,assigned_to=excluded.assigned_to,active=true,updated_at=now();
    affected := affected + 1;
  end loop;
  insert into controlti_gate_state(asset_id) select id from controlti_gate_assets where active on conflict(asset_id) do nothing;
  return affected;
end $$;

create or replace function public.controlti_register_gate_scan(p_code text)
returns table(direction text, asset_number text, serial_number text, brand text, model text, assigned_to text, occurred_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare profile profiles%rowtype; asset controlti_gate_assets%rowtype; state controlti_gate_state%rowtype; next_direction text; event_time timestamptz := clock_timestamp();
begin
  select * into profile from profiles where id=auth.uid() and active and role in ('Administrador','Inventario','Tecnico');
  if profile.id is null then raise exception 'NOT_AUTHORIZED'; end if;
  if nullif(trim(p_code),'') is null or length(p_code)>300 then raise exception 'INVALID_CODE'; end if;
  select * into asset from controlti_gate_assets a where a.active and (lower(a.asset_number)=lower(trim(p_code)) or lower(a.serial_number)=lower(trim(p_code)) or a.external_id=trim(p_code)) limit 1;
  if asset.id is null then raise exception 'ASSET_NOT_FOUND'; end if;
  insert into controlti_gate_state(asset_id) values(asset.id) on conflict(asset_id) do nothing;
  select * into state from controlti_gate_state s where s.asset_id=asset.id for update;
  if state.last_event_at is not null and state.last_event_at > event_time - interval '5 seconds' then raise exception 'DUPLICATE_SCAN'; end if;
  next_direction := case when state.location='DENTRO' then 'SALIDA' else 'ENTRADA' end;
  update controlti_gate_state set location=case when next_direction='SALIDA' then 'FUERA' else 'DENTRO' end,last_event_at=event_time,updated_at=event_time where asset_id=asset.id;
  insert into controlti_gate_events(asset_id,direction,asset_number,serial_number,brand,model,assigned_to,recorded_by,recorded_by_name,occurred_at)
  values(asset.id,next_direction,asset.asset_number,asset.serial_number,asset.brand,asset.model,asset.assigned_to,profile.id,coalesce(nullif(profile.full_name,''),profile.login),event_time);
  return query select next_direction,asset.asset_number,asset.serial_number,asset.brand,asset.model,asset.assigned_to,event_time;
end $$;
revoke all on function public.controlti_sync_gate_assets(jsonb), public.controlti_register_gate_scan(text) from public, anon;
grant execute on function public.controlti_sync_gate_assets(jsonb), public.controlti_register_gate_scan(text) to authenticated;
