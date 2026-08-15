-- Compatibilidad con claves sb_secret_... y operaciones administrativas.
create or replace function public.protect_controlti_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_privileged boolean :=
    coalesce(auth.role()::text = 'service_role', false)
    or coalesce(current_setting('request.jwt.claim.role', true) = 'service_role', false)
    or coalesce(current_setting('role', true) = 'service_role', false)
    or session_user = 'postgres';
begin
  if not is_privileged and not public.is_controlti_admin() then
    new.role := old.role;
    new.active := old.active;
    new.email := old.email;
    new.login := old.login;
    new.password_changed_at := old.password_changed_at;
  end if;
  new.updated_at := now();
  return new;
end; $$;
