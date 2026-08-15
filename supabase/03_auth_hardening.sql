-- Ejecutar después de 01_auth_profiles.sql y 02_servicedesk.sql.
create table if not exists public.controlti_login_attempts (
  key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now()
);
alter table public.controlti_login_attempts enable row level security;
revoke all on public.controlti_login_attempts from anon, authenticated;

create or replace function public.controlti_check_login_rate(
  p_keys text[], p_limit integer default 8, p_window_seconds integer default 900
) returns boolean language plpgsql security definer set search_path = public as $$
declare current_key text; current_attempts integer;
begin
  if coalesce(array_length(p_keys, 1), 0) = 0 or p_limit < 1 or p_window_seconds < 60 then return false; end if;
  delete from public.controlti_login_attempts where updated_at < now() - interval '2 days';
  foreach current_key in array p_keys loop
    insert into public.controlti_login_attempts as rate (key, window_started_at, attempts, updated_at)
    values (current_key, now(), 1, now())
    on conflict (key) do update set
      attempts = case when rate.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1 else rate.attempts + 1 end,
      window_started_at = case when rate.window_started_at <= now() - make_interval(secs => p_window_seconds) then now() else rate.window_started_at end,
      updated_at = now()
    returning attempts into current_attempts;
    if current_attempts > p_limit then return false; end if;
  end loop;
  return true;
end; $$;
revoke all on function public.controlti_check_login_rate(text[], integer, integer) from public, anon, authenticated;
grant execute on function public.controlti_check_login_rate(text[], integer, integer) to service_role;

-- Conserva la protección para clientes y permite las operaciones validadas
-- que ejecutan las Edge Functions con service_role.
create or replace function public.protect_controlti_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.is_controlti_admin() then
    new.role := old.role;
    new.active := old.active;
    new.email := old.email;
    new.login := old.login;
    new.password_changed_at := old.password_changed_at;
  end if;
  new.updated_at := now();
  return new;
end; $$;

drop policy if exists "authenticated_read_profiles" on public.profiles;
drop policy if exists "users_read_own_profile" on public.profiles;
drop policy if exists "admins_read_profiles" on public.profiles;
create policy "users_read_own_profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "admins_read_profiles" on public.profiles for select to authenticated using (public.is_controlti_admin());

drop policy if exists "users_update_own_profile" on public.profiles;
create policy "users_update_own_profile" on public.profiles for update to authenticated
  using (id = auth.uid() and active = true) with check (id = auth.uid() and active = true);

drop policy if exists "ticket_visible_to_participants" on public.tickets;
create policy "ticket_visible_to_participants" on public.tickets for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.active) and (
    public.is_controlti_admin() or user_id = auth.uid() or
    (assigned_role = 'Tecnico' and assigned_user_id = auth.uid() and
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'Tecnico' and p.active))
  )
);

drop policy if exists "users_create_own_tickets" on public.tickets;
create policy "users_create_own_tickets" on public.tickets for insert to authenticated with check (
  user_id = auth.uid() and assigned_role = 'Administrador' and assigned_user_id is null and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.active)
);

drop policy if exists "participants_create_messages" on public.ticket_messages;
create policy "participants_create_messages" on public.ticket_messages for insert to authenticated with check (
  author_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active) and
  exists (select 1 from public.tickets t where t.id = ticket_id)
);

-- Los datos de identidad y asignación se derivan en servidor, no del navegador.
create or replace function public.controlti_protect_ticket_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare profile public.profiles%rowtype;
begin
  select * into profile from public.profiles where id = auth.uid() and active;
  if profile.id is null then raise exception 'Cuenta inactiva'; end if;
  new.user_id := profile.id;
  new.requester_name := profile.full_name;
  new.requester_email := profile.email;
  new.requester_area := profile.area;
  new.assigned_role := 'Administrador';
  new.assigned_user_id := null;
  new.assigned_name := 'Mesa de administradores';
  new.status := 'Abierto';
  return new;
end; $$;

drop trigger if exists protect_controlti_ticket_insert on public.tickets;
create trigger protect_controlti_ticket_insert before insert on public.tickets
  for each row execute procedure public.controlti_protect_ticket_insert();

create or replace function public.controlti_protect_ticket_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then return new; end if;
  if public.is_controlti_admin() then return new; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'Tecnico'
  ) or old.assigned_user_id is distinct from auth.uid() then
    raise exception 'Operación no autorizada';
  end if;
  new.id := old.id; new.folio := old.folio; new.user_id := old.user_id;
  new.requester_name := old.requester_name; new.requester_email := old.requester_email;
  new.requester_area := old.requester_area; new.asset := old.asset;
  new.category := old.category; new.priority := old.priority; new.subject := old.subject;
  new.assigned_role := old.assigned_role; new.assigned_user_id := old.assigned_user_id;
  new.assigned_name := old.assigned_name; new.created_at := old.created_at;
  return new;
end; $$;

drop trigger if exists protect_controlti_ticket_update on public.tickets;
create trigger protect_controlti_ticket_update before update on public.tickets
  for each row execute procedure public.controlti_protect_ticket_update();

create or replace function public.controlti_set_message_author()
returns trigger language plpgsql security definer set search_path = public as $$
declare profile public.profiles%rowtype;
begin
  select * into profile from public.profiles where id = auth.uid() and active;
  if profile.id is null then raise exception 'Cuenta inactiva'; end if;
  new.author_id := profile.id;
  new.author_name := profile.full_name;
  new.author_role := profile.role;
  return new;
end; $$;

drop trigger if exists set_controlti_message_author on public.ticket_messages;
create trigger set_controlti_message_author before insert on public.ticket_messages
  for each row execute procedure public.controlti_set_message_author();
