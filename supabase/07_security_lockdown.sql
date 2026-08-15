-- Revoca acceso RPC a funciones diseñadas exclusivamente para triggers.
revoke execute on function public.controlti_assign_ticket_folio() from public, anon, authenticated;
revoke execute on function public.controlti_protect_ticket_insert() from public, anon, authenticated;
revoke execute on function public.controlti_protect_ticket_update() from public, anon, authenticated;
revoke execute on function public.controlti_set_message_author() from public, anon, authenticated;
revoke execute on function public.controlti_touch_ticket() from public, anon, authenticated;
revoke execute on function public.controlti_touch_ticket_from_message() from public, anon, authenticated;
revoke execute on function public.handle_controlti_user() from public, anon, authenticated;
revoke execute on function public.normalize_controlti_profile_identity() from public, anon, authenticated;
revoke execute on function public.protect_controlti_profile() from public, anon, authenticated;

-- Esta función participa en políticas RLS; sólo las sesiones autenticadas la requieren.
revoke execute on function public.is_controlti_admin() from public, anon;
grant execute on function public.is_controlti_admin() to authenticated;
