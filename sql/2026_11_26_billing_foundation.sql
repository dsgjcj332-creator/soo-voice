-- Billing data foundation. No plan prices, promotions, or payment provider
-- are seeded here; commercial terms and gateway selection remain explicit decisions.

begin;

create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique
    check (plan_key ~ '^[a-z][a-z0-9_-]{1,39}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  description text,
  features jsonb not null default '{}'::jsonb
    check (jsonb_typeof(features) = 'object'),
  usage_limits jsonb not null default '{}'::jsonb
    check (jsonb_typeof(usage_limits) = 'object'),
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.billing_plans(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  billing_interval text not null check (billing_interval in ('monthly','yearly')),
  amount_minor bigint not null check (amount_minor >= 0),
  is_active boolean not null default false,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from),
  unique(plan_id, currency, billing_interval, effective_from),
  unique(id, plan_id)
);

create index if not exists billing_plan_prices_public_idx
  on public.billing_plan_prices(plan_id, currency, billing_interval)
  where is_active = true;

create table if not exists public.merchant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  plan_id uuid not null references public.billing_plans(id) on delete restrict,
  price_id uuid references public.billing_plan_prices(id) on delete restrict,
  status text not null check (status in (
    'trialing','active','past_due','paused','canceled','incomplete','expired'
  )),
  billing_interval text check (billing_interval in ('monthly','yearly')),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  payment_provider text,
  external_subscription_id text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trial_ends_at is null or trial_starts_at is null or trial_ends_at > trial_starts_at),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start),
  constraint merchant_subscriptions_price_plan_fk
    foreign key (price_id, plan_id)
    references public.billing_plan_prices(id, plan_id) on delete restrict,
  unique(id, owner_id)
);

create index if not exists merchant_subscriptions_owner_idx
  on public.merchant_subscriptions(owner_id, created_at desc);
create index if not exists merchant_subscriptions_status_period_idx
  on public.merchant_subscriptions(status, current_period_end);
create unique index if not exists merchant_subscriptions_provider_external_uidx
  on public.merchant_subscriptions(payment_provider, external_subscription_id)
  where payment_provider is not null and external_subscription_id is not null;

create table if not exists public.billing_promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code ~ '^[A-Z0-9_-]{3,40}$'),
  description text,
  discount_type text not null check (discount_type in ('percent','fixed')),
  percent_off smallint,
  amount_off_minor bigint,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  first_ten_offer boolean not null default false,
  applicable_plan_keys text[] not null default '{}',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (discount_type = 'percent' and percent_off is not null and percent_off between 1 and 100 and amount_off_minor is null)
    or
    (discount_type = 'fixed' and amount_off_minor is not null and amount_off_minor > 0 and percent_off is null and currency is not null)
  ),
  check (max_redemptions is null or redemption_count <= max_redemptions)
);

create table if not exists public.billing_promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.billing_promotions(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  subscription_id uuid references public.merchant_subscriptions(id) on delete restrict,
  discount_amount_minor bigint not null check (discount_amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  redeemed_at timestamptz not null default now(),
  unique(promotion_id, owner_id),
  foreign key (subscription_id, owner_id)
    references public.merchant_subscriptions(id, owner_id) on delete restrict
);

create index if not exists billing_promotion_redemptions_owner_idx
  on public.billing_promotion_redemptions(owner_id, redeemed_at desc);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  owner_id uuid not null references auth.users(id) on delete restrict,
  subscription_id uuid references public.merchant_subscriptions(id) on delete restrict,
  status text not null check (status in ('draft','open','paid','void','uncollectible')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (discount_minor <= subtotal_minor),
  check (total_minor = subtotal_minor - discount_minor + tax_minor),
  foreign key (subscription_id, owner_id)
    references public.merchant_subscriptions(id, owner_id) on delete restrict,
  unique(id, owner_id, currency)
);

create index if not exists billing_invoices_owner_idx
  on public.billing_invoices(owner_id, issued_at desc);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete restrict,
  provider text not null check (length(btrim(provider)) between 1 and 40),
  provider_payment_id text,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  status text not null check (status in (
    'pending','authorized','succeeded','failed','refunded','partially_refunded'
  )),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  failure_code text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, idempotency_key),
  foreign key (invoice_id, owner_id, currency)
    references public.billing_invoices(id, owner_id, currency) on delete restrict
);

create unique index if not exists billing_payments_provider_payment_uidx
  on public.billing_payments(provider, provider_payment_id)
  where provider_payment_id is not null;
create index if not exists billing_payments_owner_idx
  on public.billing_payments(owner_id, created_at desc);

create table if not exists public.billing_usage_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  subscription_id uuid references public.merchant_subscriptions(id) on delete restrict,
  metric text not null check (metric ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  quantity numeric(20,6) not null check (quantity >= 0),
  unit text not null check (length(btrim(unit)) between 1 and 32),
  period_start timestamptz not null,
  period_end timestamptz not null,
  source_reference text,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  created_at timestamptz not null default now(),
  check (period_end > period_start),
  unique(owner_id, metric, idempotency_key),
  foreign key (subscription_id, owner_id)
    references public.merchant_subscriptions(id, owner_id) on delete restrict
);

create index if not exists billing_usage_owner_period_idx
  on public.billing_usage_records(owner_id, period_start, metric);

create table if not exists public.billing_subscription_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  subscription_id uuid references public.merchant_subscriptions(id) on delete restrict,
  event_type text not null check (length(btrim(event_type)) between 1 and 80),
  actor_type text not null check (actor_type in ('system','merchant','admin','provider')),
  actor_id text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (subscription_id, owner_id)
    references public.merchant_subscriptions(id, owner_id) on delete restrict
);

create index if not exists billing_subscription_events_owner_idx
  on public.billing_subscription_events(owner_id, created_at desc);

-- Audit events are append-only even for service-role application code.
create or replace function public.prevent_billing_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'BILLING_EVENTS_ARE_APPEND_ONLY';
end;
$$;

drop trigger if exists billing_subscription_events_immutable on public.billing_subscription_events;
create trigger billing_subscription_events_immutable
  before update or delete on public.billing_subscription_events
  for each row execute function public.prevent_billing_event_mutation();

-- Admin claims must live in trusted app_metadata, never user-editable metadata.
create or replace function public.is_soovoice_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $
  select coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb #>> '{app_metadata,role}') = 'admin'
    or (
      coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb #> '{app_metadata,roles}',
        '[]'::jsonb
      ) ? 'admin'
    ),
    false
  );
$;

revoke all on function public.is_soovoice_platform_admin() from public, anon;
grant execute on function public.is_soovoice_platform_admin() to authenticated, service_role;

-- All billing data is private by default. Merchants can read only their own
-- subscription, invoice, payment, usage, redemption and event rows.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'billing_plans',
    'billing_plan_prices',
    'merchant_subscriptions',
    'billing_promotions',
    'billing_promotion_redemptions',
    'billing_invoices',
    'billing_payments',
    'billing_usage_records',
    'billing_subscription_events'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end;
$$;

drop policy if exists billing_plans_platform_admin_read on public.billing_plans;
create policy billing_plans_platform_admin_read on public.billing_plans
  for select to authenticated using (public.is_soovoice_platform_admin());

drop policy if exists billing_plan_prices_platform_admin_read on public.billing_plan_prices;
create policy billing_plan_prices_platform_admin_read on public.billing_plan_prices
  for select to authenticated using (public.is_soovoice_platform_admin());

drop policy if exists billing_promotions_platform_admin_read on public.billing_promotions;
create policy billing_promotions_platform_admin_read on public.billing_promotions
  for select to authenticated using (public.is_soovoice_platform_admin());

drop policy if exists merchant_subscriptions_platform_admin_read on public.merchant_subscriptions;
create policy merchant_subscriptions_platform_admin_read on public.merchant_subscriptions
  for select to authenticated using (public.is_soovoice_platform_admin());

drop policy if exists billing_promotion_redemptions_platform_admin_read on public.billing_promotion_redemptions;
create policy billing_promotion_redemptions_platform_admin_read on public.billing_promotion_redemptions
  for select to authenticated using (public.is_soovoice_platform_admin());

drop policy if exists billing_invoices_platform_admin_read on public.billing_invoices;
create policy billing_invoices_platform_admin_read on public.billing_invoices
  for select to authenticated using (public.is_soovoice_platform_admin());

drop policy if exists billing_payments_platform_admin_read on public.billing_payments;
create policy billing_payments_platform_admin_read on public.billing_payments
  for select to authenticated using (public.is_soovoice_platform_admin());

drop policy if exists billing_usage_records_platform_admin_read on public.billing_usage_records;
create policy billing_usage_records_platform_admin_read on public.billing_usage_records
  for select to authenticated using (public.is_soovoice_platform_admin());

drop policy if exists billing_subscription_events_platform_admin_read on public.billing_subscription_events;
create policy billing_subscription_events_platform_admin_read on public.billing_subscription_events
  for select to authenticated using (public.is_soovoice_platform_admin());

drop policy if exists billing_plans_public_active_read on public.billing_plans;
create policy billing_plans_public_active_read on public.billing_plans
  for select to anon, authenticated using (is_active = true);

drop policy if exists billing_plan_prices_public_active_read on public.billing_plan_prices;
create policy billing_plan_prices_public_active_read on public.billing_plan_prices
  for select to anon, authenticated using (
    is_active = true
    and effective_from <= now()
    and (effective_until is null or effective_until > now())
    and exists (
      select 1 from public.billing_plans p
       where p.id = plan_id and p.is_active = true
    )
  );

drop policy if exists merchant_subscriptions_owner_read on public.merchant_subscriptions;
create policy merchant_subscriptions_owner_read on public.merchant_subscriptions
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists billing_promotion_redemptions_owner_read on public.billing_promotion_redemptions;
create policy billing_promotion_redemptions_owner_read on public.billing_promotion_redemptions
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists billing_invoices_owner_read on public.billing_invoices;
create policy billing_invoices_owner_read on public.billing_invoices
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists billing_payments_owner_read on public.billing_payments;
create policy billing_payments_owner_read on public.billing_payments
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists billing_usage_records_owner_read on public.billing_usage_records;
create policy billing_usage_records_owner_read on public.billing_usage_records
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists billing_subscription_events_owner_read on public.billing_subscription_events;
create policy billing_subscription_events_owner_read on public.billing_subscription_events
  for select to authenticated using (owner_id = auth.uid());

-- Client roles are read-only. Subscription/payment/promotion mutations must
-- come from authenticated server-side workflows using service_role.
revoke all on public.billing_plans, public.billing_plan_prices,
  public.merchant_subscriptions, public.billing_promotions,
  public.billing_promotion_redemptions, public.billing_invoices,
  public.billing_payments, public.billing_usage_records,
  public.billing_subscription_events from public, anon, authenticated;

grant select on public.billing_plans, public.billing_plan_prices to anon, authenticated;
grant select on public.merchant_subscriptions, public.billing_promotion_redemptions,
  public.billing_invoices, public.billing_payments, public.billing_usage_records,
  public.billing_subscription_events to authenticated;

grant all on public.billing_plans, public.billing_plan_prices,
  public.merchant_subscriptions, public.billing_promotions,
  public.billing_promotion_redemptions, public.billing_invoices,
  public.billing_payments, public.billing_usage_records,
  public.billing_subscription_events to service_role;

commit;
