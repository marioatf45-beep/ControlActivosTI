-- Control de Activos TI: ServiceDesk centralizado
-- Ejecutar una sola vez desde Supabase > SQL Editor.

create sequence if not exists public.controlti_ticket_sequence start 1;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  requester_name text not null,
  requester_email text not null,
  requester_area text not null default '',
  asset jsonb,
  category text not null,
  priority text not null default 'Media',
  subject text not null,
  assigned_role text not null default 'Administrador'
    check (assigned_role in ('Administrador', 'Tecnico')),
  assigned_user_id uuid references public.profiles(id) on delete set null,
  assigned_name text not null default 'Mesa de administradores',
  status text not null default 'Abierto'
    check (status in ('Abierto', 'En atención', 'Resuelto', 'Cerrado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  author_name text not null,
  author_role text not null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists tickets_user_id_idx on public.tickets(user_id);
create index if not exists tickets_assigned_user_id_idx on public.tickets(assigned_user_id);
create index if not exists tickets_updated_at_idx on public.tickets(updated_at desc);
create index if not exists ticket_messages_ticket_id_idx on public.ticket_messages(ticket_id, created_at);

create or replace function public.controlti_assign_ticket_folio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.folio is null or trim(new.folio) = '' then
    new.folio := 'SD-' || to_char(now(), 'YYYYMMDD') || '-' ||
      lpad(nextval('public.controlti_ticket_sequence')::text, 4, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists assign_controlti_ticket_folio on public.tickets;
create trigger assign_controlti_ticket_folio
  before insert on public.tickets
  for each row execute procedure public.controlti_assign_ticket_folio();

create or replace function public.controlti_touch_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_controlti_ticket on public.tickets;
create trigger touch_controlti_ticket
  before update on public.tickets
  for each row execute procedure public.controlti_touch_ticket();

create or replace function public.controlti_touch_ticket_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tickets set updated_at = now() where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists touch_ticket_from_message on public.ticket_messages;
create trigger touch_ticket_from_message
  after insert on public.ticket_messages
  for each row execute procedure public.controlti_touch_ticket_from_message();

alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

drop policy if exists "ticket_visible_to_participants" on public.tickets;
create policy "ticket_visible_to_participants"
  on public.tickets for select
  to authenticated
  using (
    public.is_controlti_admin()
    or user_id = auth.uid()
    or (
      assigned_role = 'Tecnico'
      and assigned_user_id = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'Tecnico' and p.active = true
      )
    )
  );

drop policy if exists "users_create_own_tickets" on public.tickets;
create policy "users_create_own_tickets"
  on public.tickets for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and assigned_role = 'Administrador'
    and assigned_user_id is null
  );

drop policy if exists "staff_update_visible_tickets" on public.tickets;
create policy "staff_update_visible_tickets"
  on public.tickets for update
  to authenticated
  using (
    public.is_controlti_admin()
    or (
      assigned_role = 'Tecnico'
      and assigned_user_id = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'Tecnico' and p.active = true
      )
    )
  )
  with check (
    public.is_controlti_admin()
    or assigned_user_id = auth.uid()
  );

drop policy if exists "messages_visible_with_ticket" on public.ticket_messages;
create policy "messages_visible_with_ticket"
  on public.ticket_messages for select
  to authenticated
  using (
    exists (select 1 from public.tickets t where t.id = ticket_id)
  );

drop policy if exists "participants_create_messages" on public.ticket_messages;
create policy "participants_create_messages"
  on public.ticket_messages for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.tickets t where t.id = ticket_id)
  );

grant select, insert on public.tickets to authenticated;
grant update on public.tickets to authenticated;
grant select, insert on public.ticket_messages to authenticated;
revoke all on public.tickets from anon;
revoke all on public.ticket_messages from anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tickets'
  ) then
    alter publication supabase_realtime add table public.tickets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ticket_messages'
  ) then
    alter publication supabase_realtime add table public.ticket_messages;
  end if;
end;
$$;

