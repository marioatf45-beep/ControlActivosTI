-- Exige AAL2 para cualquier privilegio administrativo.
create or replace function public.is_controlti_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(auth.jwt()->>'aal','aal1')='aal2' and exists (
    select 1 from public.profiles where id=auth.uid() and role='Administrador' and active
  );
$$;
revoke execute on function public.is_controlti_admin() from public,anon;
grant execute on function public.is_controlti_admin() to authenticated;

alter function public.controlti_get_system_state() rename to controlti_get_system_state_internal_v8;
revoke all on function public.controlti_get_system_state_internal_v8() from public,anon,authenticated;
create function public.controlti_get_system_state()
returns jsonb language plpgsql security definer set search_path=public as $$
declare role_name text;
begin
  select role into role_name from profiles where id=auth.uid() and active;
  if role_name='Administrador' and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'MFA_REQUIRED'; end if;
  return public.controlti_get_system_state_internal_v8();
end $$;
revoke all on function public.controlti_get_system_state() from public,anon;
grant execute on function public.controlti_get_system_state() to authenticated;

alter function public.controlti_save_system_state(jsonb) rename to controlti_save_system_state_internal_v8;
revoke all on function public.controlti_save_system_state_internal_v8(jsonb) from public,anon,authenticated;
create function public.controlti_save_system_state(p_data jsonb)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare role_name text;
begin
  select role into role_name from profiles where id=auth.uid() and active;
  if role_name='Administrador' and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'MFA_REQUIRED'; end if;
  return public.controlti_save_system_state_internal_v8(p_data);
end $$;
revoke all on function public.controlti_save_system_state(jsonb) from public,anon;
grant execute on function public.controlti_save_system_state(jsonb) to authenticated;

alter function public.controlti_register_gate_scan(text) rename to controlti_register_gate_scan_internal_v8;
revoke all on function public.controlti_register_gate_scan_internal_v8(text) from public,anon,authenticated;
create function public.controlti_register_gate_scan(p_code text)
returns table(direction text,asset_number text,serial_number text,brand text,model text,assigned_to text,occurred_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare role_name text;
begin
  select role into role_name from profiles where id=auth.uid() and active;
  if role_name='Administrador' and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'MFA_REQUIRED'; end if;
  return query select * from public.controlti_register_gate_scan_internal_v8(p_code);
end $$;
revoke all on function public.controlti_register_gate_scan(text) from public,anon;
grant execute on function public.controlti_register_gate_scan(text) to authenticated;

drop policy if exists "active_users_read_assets" on public.controlti_assets;
create policy "active_users_read_assets" on public.controlti_assets for select to authenticated using (
  active and exists (select 1 from profiles p where p.id=auth.uid() and p.active and p.role<>'ServiceDesk' and (p.role<>'Administrador' or coalesce(auth.jwt()->>'aal','aal1')='aal2'))
);
drop policy if exists "active_users_read_gate_assets" on public.controlti_gate_assets;
create policy "active_users_read_gate_assets" on public.controlti_gate_assets for select to authenticated using (
  exists (select 1 from profiles p where p.id=auth.uid() and p.active and p.role<>'ServiceDesk' and (p.role<>'Administrador' or coalesce(auth.jwt()->>'aal','aal1')='aal2'))
);
drop policy if exists "active_users_read_gate_state" on public.controlti_gate_state;
create policy "active_users_read_gate_state" on public.controlti_gate_state for select to authenticated using (
  exists (select 1 from profiles p where p.id=auth.uid() and p.active and p.role<>'ServiceDesk' and (p.role<>'Administrador' or coalesce(auth.jwt()->>'aal','aal1')='aal2'))
);
drop policy if exists "active_users_read_gate_events" on public.controlti_gate_events;
create policy "active_users_read_gate_events" on public.controlti_gate_events for select to authenticated using (
  exists (select 1 from profiles p where p.id=auth.uid() and p.active and p.role<>'ServiceDesk' and (p.role<>'Administrador' or coalesce(auth.jwt()->>'aal','aal1')='aal2'))
);
