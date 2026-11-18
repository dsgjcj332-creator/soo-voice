-- POS dispatch alerts: one row per order-outbox event that exhausted its
-- retries and landed in dead_letter. The scheduled worker (service role)
-- inserts alerts; the owning merchant reads them through owner-scoped RLS.
-- Merchants cannot create, modify or delete alerts from clients.
begin;
create table if not exists public.pos_dispatch_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  order_id text not null,
  event_id uuid not null unique,
  error_code text,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now()
);
create index if not exists pos_dispatch_alerts_owner_created_idx
  on public.pos_dispatch_alerts (owner_id, created_at desc);
alter table public.pos_dispatch_alerts enable row level security;
drop policy if exists "pos_dispatch_alerts_owner_read" on public.pos_dispatch_alerts;
create policy "pos_dispatch_alerts_owner_read" on public.pos_dispatch_alerts
  for select to authenticated using (owner_id = auth.uid());
revoke all on public.pos_dispatch_alerts from public;
revoke all on public.pos_dispatch_alerts from anon;
revoke all on public.pos_dispatch_alerts from authenticated;
grant select on public.pos_dispatch_alerts to authenticated;
grant all on public.pos_dispatch_alerts to service_role;
commit;
