-- Trusted platform-admin access to billing catalog and read-only billing oversight.

begin;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = public, auth
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false)
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false);
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;

-- Catalog management is admin-only. Public active-plan reads remain in place.
drop policy if exists billing_plans_platform_admin_manage on public.billing_plans;
create policy billing_plans_platform_admin_manage on public.billing_plans
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists billing_plan_prices_platform_admin_manage on public.billing_plan_prices;
create policy billing_plan_prices_platform_admin_manage on public.billing_plan_prices
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists billing_promotions_platform_admin_manage on public.billing_promotions;
create policy billing_promotions_platform_admin_manage on public.billing_promotions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant insert, update, delete on public.billing_plans, public.billing_plan_prices,
  public.billing_promotions to authenticated;

-- Platform admins can inspect billing state, but subscription/payment mutations
-- remain server-only and cannot be performed directly from the browser.
drop policy if exists merchant_subscriptions_platform_admin_read on public.merchant_subscriptions;
create policy merchant_subscriptions_platform_admin_read on public.merchant_subscriptions
  for select to authenticated using (public.is_platform_admin());

drop policy if exists billing_promotion_redemptions_platform_admin_read on public.billing_promotion_redemptions;
create policy billing_promotion_redemptions_platform_admin_read on public.billing_promotion_redemptions
  for select to authenticated using (public.is_platform_admin());

drop policy if exists billing_invoices_platform_admin_read on public.billing_invoices;
create policy billing_invoices_platform_admin_read on public.billing_invoices
  for select to authenticated using (public.is_platform_admin());

drop policy if exists billing_payments_platform_admin_read on public.billing_payments;
create policy billing_payments_platform_admin_read on public.billing_payments
  for select to authenticated using (public.is_platform_admin());

drop policy if exists billing_usage_records_platform_admin_read on public.billing_usage_records;
create policy billing_usage_records_platform_admin_read on public.billing_usage_records
  for select to authenticated using (public.is_platform_admin());

drop policy if exists billing_subscription_events_platform_admin_read on public.billing_subscription_events;
create policy billing_subscription_events_platform_admin_read on public.billing_subscription_events
  for select to authenticated using (public.is_platform_admin());

create table if not exists public.billing_admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('insert','update','delete')),
  entity_type text not null check (entity_type in ('billing_plans','billing_plan_prices','billing_promotions')),
  entity_id uuid not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_admin_audit_events_created_idx
  on public.billing_admin_audit_events(created_at desc);
create index if not exists billing_admin_audit_events_entity_idx
  on public.billing_admin_audit_events(entity_type, entity_id, created_at desc);

alter table public.billing_admin_audit_events enable row level security;
revoke all on public.billing_admin_audit_events from public, anon, authenticated;
grant select on public.billing_admin_audit_events to authenticated;
grant all on public.billing_admin_audit_events to service_role;

drop policy if exists billing_admin_audit_events_platform_admin_read on public.billing_admin_audit_events;
create policy billing_admin_audit_events_platform_admin_read on public.billing_admin_audit_events
  for select to authenticated using (public.is_platform_admin());

create or replace function public.record_billing_catalog_audit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_id uuid;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
    v_id := new.id;
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_id := new.id;
  else
    v_before := to_jsonb(old);
    v_id := old.id;
  end if;

  insert into public.billing_admin_audit_events(
    actor_id, action, entity_type, entity_id, before_state, after_state
  ) values (
    auth.uid(), lower(tg_op), tg_table_name, v_id, v_before, v_after
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists billing_plans_admin_audit on public.billing_plans;
create trigger billing_plans_admin_audit
  after insert or update or delete on public.billing_plans
  for each row execute function public.record_billing_catalog_audit();

drop trigger if exists billing_plan_prices_admin_audit on public.billing_plan_prices;
create trigger billing_plan_prices_admin_audit
  after insert or update or delete on public.billing_plan_prices
  for each row execute function public.record_billing_catalog_audit();

drop trigger if exists billing_promotions_admin_audit on public.billing_promotions;
create trigger billing_promotions_admin_audit
  after insert or update or delete on public.billing_promotions
  for each row execute function public.record_billing_catalog_audit();

-- The audit trail is append-only.
drop trigger if exists billing_admin_audit_events_immutable on public.billing_admin_audit_events;
create trigger billing_admin_audit_events_immutable
  before update or delete on public.billing_admin_audit_events
  for each row execute function public.prevent_billing_event_mutation();

commit;
