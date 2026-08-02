-- Control de Activos TI: autenticacion y perfiles centrales
-- Ejecutar una sola vez desde Supabase > SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  login text not null unique,
  full_name text not null default '',
  area text not null default '',
  role text not null default 'ServiceDesk'
    check (role in ('Administrador', 'Tecnico', 'Inventario', 'SoloLectura', 'ServiceDesk')),
  active boolean not null default true,
  password_changed_at timestamptz not null default now(),
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_controlti_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'Administrador'
      and active = true
  );
$$;

revoke all on function public.is_controlti_admin() from public;
grant execute on function public.is_controlti_admin() to authenticated;

create or replace function public.handle_controlti_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  requested_login text := case
    when normalized_email = 'mario.torres@dtroylogistics.com' then 'm.torres'
    else lower(coalesce(new.raw_user_meta_data ->> 'login', split_part(normalized_email, '@', 1)))
  end;
begin
  insert into public.profiles (id, email, login, full_name, area, role)
  values (
    new.id,
    normalized_email,
    requested_login,
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'area', '')),
    case
      when normalized_email = 'mario.torres@dtroylogistics.com' then 'Administrador'
      else 'ServiceDesk'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_controlti_user_created on auth.users;
create trigger on_controlti_user_created
  after insert on auth.users
  for each row execute procedure public.handle_controlti_user();

create or replace function public.protect_controlti_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_controlti_admin() then
    new.role := old.role;
    new.active := old.active;
    new.email := old.email;
    new.login := old.login;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_controlti_profile_update on public.profiles;
create trigger protect_controlti_profile_update
  before update on public.profiles
  for each row execute procedure public.protect_controlti_profile();

drop policy if exists "authenticated_read_profiles" on public.profiles;
create policy "authenticated_read_profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "users_update_own_profile" on public.profiles;
create policy "users_update_own_profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_controlti_admin())
  with check (id = auth.uid() or public.is_controlti_admin());

grant select, update on public.profiles to authenticated;
revoke all on public.profiles from anon;
