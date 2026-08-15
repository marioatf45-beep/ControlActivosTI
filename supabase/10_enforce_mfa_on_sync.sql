-- Completa la protección AAL2 para las sincronizaciones administrativas.
-- Los roles operativos conservan su acceso actual; Administrador requiere MFA.

alter function public.controlti_sync_assets(jsonb, text[])
  rename to controlti_sync_assets_internal_v9;
revoke all on function public.controlti_sync_assets_internal_v9(jsonb, text[])
  from public, anon, authenticated;

create function public.controlti_sync_assets(
  p_assets jsonb,
  p_removed_ids text[] default '{}'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  select role into role_name
  from public.profiles
  where id = auth.uid() and active;

  if role_name is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if role_name = 'Administrador'
     and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'MFA_REQUIRED';
  end if;

  return public.controlti_sync_assets_internal_v9(p_assets, p_removed_ids);
end;
$$;
revoke all on function public.controlti_sync_assets(jsonb, text[])
  from public, anon;
grant execute on function public.controlti_sync_assets(jsonb, text[])
  to authenticated;

alter function public.controlti_sync_gate_assets(jsonb)
  rename to controlti_sync_gate_assets_internal_v9;
revoke all on function public.controlti_sync_gate_assets_internal_v9(jsonb)
  from public, anon, authenticated;

create function public.controlti_sync_gate_assets(p_assets jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  select role into role_name
  from public.profiles
  where id = auth.uid() and active;

  if role_name is null then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if role_name = 'Administrador'
     and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'MFA_REQUIRED';
  end if;

  return public.controlti_sync_gate_assets_internal_v9(p_assets);
end;
$$;
revoke all on function public.controlti_sync_gate_assets(jsonb)
  from public, anon;
grant execute on function public.controlti_sync_gate_assets(jsonb)
  to authenticated;
