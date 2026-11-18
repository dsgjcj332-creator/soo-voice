-- Billing gateway integrity: seed idempotency and external-subscription uniqueness.
-- Run after sql/2026_12_10_billing_subscriptions_external_unique.sql and
-- sql/2026_12_11_billing_plans_seed.sql in the isolated CI database.

select set_config('request.jwt.claim.role', 'service_role', false);

-- ---------- 1. Seed idempotency: re-running the seed changes nothing ----------
\i sql/2026_12_11_billing_plans_seed.sql

do $$
declare
  v_plans int;
  v_prices int;
begin
  select count(*) into v_plans from public.billing_plans where plan_key in ('free', 'pro', 'enterprise');
  if v_plans <> 3 then
    raise exception 'SEED_PLANS_EXPECTED_3_FOUND_%', v_plans;
  end if;

  select count(*) into v_prices
  from public.billing_plan_prices p
  join public.billing_plans pl on pl.id = p.plan_id
  where pl.plan_key in ('free', 'pro', 'enterprise') and p.is_active = true and p.effective_until is null;
  if v_prices <> 15 then
    raise exception 'SEED_PRICES_EXPECTED_15_FOUND_%', v_prices;
  end if;
end $$;

-- ---------- 2. Seed invariants: exactly one open price per combination ----------
do $$
declare
  v_duplicates int;
begin
  select count(*) into v_duplicates from (
    select plan_id, currency, billing_interval
    from public.billing_plan_prices
    where is_active = true and effective_until is null
    group by plan_id, currency, billing_interval
    having count(*) > 1
  ) d;
  if v_duplicates <> 0 then
    raise exception 'SEED_DUPLICATE_ACTIVE_PRICES_%', v_duplicates;
  end if;

  if not exists (
    select 1 from public.billing_plan_prices p
    join public.billing_plans pl on pl.id = p.plan_id
    where pl.plan_key = 'pro' and p.currency = 'EGP'
      and p.billing_interval = 'monthly' and p.amount_minor = 490
  ) then
    raise exception 'SEED_PRO_EGP_MONTHLY_PRICE_MISSING';
  end if;

  -- Free plan must cost zero so checkout can be exercised without charging.
  if exists (
    select 1 from public.billing_plan_prices p
    join public.billing_plans pl on pl.id = p.plan_id
    where pl.plan_key = 'free' and p.amount_minor <> 0
  ) then
    raise exception 'SEED_FREE_PLAN_PRICES_MUST_BE_ZERO';
  end if;
end $$;

-- ---------- 3. Partial unique index: duplicate gateway reference rejected ----------
do $$
declare
  v_plan_id uuid;
  v_price_id uuid;
begin
  select id into v_plan_id from public.billing_plans where plan_key = 'pro' limit 1;
  select id into v_price_id from public.billing_plan_prices
  where plan_id = v_plan_id and currency = 'EGP' and billing_interval = 'monthly' limit 1;

  insert into public.merchant_subscriptions(
    owner_id, plan_id, price_id, status, billing_interval, currency,
    payment_provider, external_subscription_id
  ) values (
    '11111111-1111-4111-8111-111111111111', v_plan_id, v_price_id, 'active', 'monthly', 'EGP',
    'stripe', 'sub_ci_duplicate_check'
  );

  begin
    insert into public.merchant_subscriptions(
      owner_id, plan_id, price_id, status, billing_interval, currency,
      payment_provider, external_subscription_id
    ) values (
      '11111111-1111-4111-8111-111111111111', v_plan_id, v_price_id, 'active', 'monthly', 'EGP',
      'stripe', 'sub_ci_duplicate_check'
    );
    raise exception 'EXTERNAL_SUBSCRIPTION_UNIQUENESS_NOT_ENFORCED';
  exception
    when unique_violation then null; -- expected
  end;
end $$;

-- ---------- 4. Rows without a gateway reference are unaffected ----------
do $$
declare
  v_plan_id uuid;
  v_price_id uuid;
  v_count int;
begin
  select id into v_plan_id from public.billing_plans where plan_key = 'pro' limit 1;
  select id into v_price_id from public.billing_plan_prices
  where plan_id = v_plan_id and currency = 'EGP' and billing_interval = 'monthly' limit 1;

  insert into public.merchant_subscriptions(
    owner_id, plan_id, price_id, status, billing_interval, currency
  ) values
    ('11111111-1111-4111-8111-111111111111', v_plan_id, v_price_id, 'active', 'monthly', 'EGP'),
    ('11111111-1111-4111-8111-111111111111', v_plan_id, v_price_id, 'trialing', 'monthly', 'EGP');

  select count(*) into v_count
  from public.merchant_subscriptions
  where owner_id = '11111111-1111-4111-8111-111111111111' and external_subscription_id is null;
  if v_count < 2 then
    raise exception 'NULL_EXTERNAL_SUBSCRIPTION_INSERTS_REJECTED_%', v_count;
  end if;
end $$;
