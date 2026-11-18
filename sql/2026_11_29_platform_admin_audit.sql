-- Append-only audit trail for privileged platform billing changes.
begin;

create table if not exists public.platform_admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  resource_type text not null check (resource_type ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  resource_id text,
  before_state jsonb not null default '{}'::jsonb check (jsonb_typeof(before_state) = 'object'),
  after_state jsonb not null default '{}'::jsonb check (jsonb_typeof(after_state) = 'object'),
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists platform_admin_audit_events_created_idx
  on public.platform_admin_audit_events(created_at desc);
create index if not exists platform_admin_audit_events_actor_idx
  on public.platform_admin_audit_events(actor_id, created_at desc);
create index if not exists platform_admin_audit_events_resource_idx
  on public.platform_admin_audit_events(resource_type, resource_id, created_at desc);

alter table public.platform_admin_audit_events enable row level security;
revoke all on public.platform_admin_audit_events from public, anon, authenticated;
grant select on public.platform_admin_audit_events to authenticated;
grant insert on public.platform_admin_audit_events to service_role;
drop policy if exists platform_admin_audit_events_admin_read on public.platform_admin_audit_events;
create policy platform_admin_audit_events_admin_read
  on public.platform_admin_audit_events for select to authenticated
  using (public.is_soovoice_platform_admin());

create or replace function public.prevent_platform_admin_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'PLATFORM_ADMIN_AUDIT_IS_APPEND_ONLY';
end;
$$;

drop trigger if exists platform_admin_audit_events_immutable on public.platform_admin_audit_events;
create trigger platform_admin_audit_events_immutable
  before update or delete on public.platform_admin_audit_events
  for each row execute function public.prevent_platform_admin_audit_mutation();

commit;
