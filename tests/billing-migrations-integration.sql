-- Billing foundation behavioral and RLS tests.
-- Run after sql/2026_11_26_billing_foundation.sql in the isolated CI database.

select set_config('request.jwt.claim.role', 'service_role', false);

insert into public.billing_plans(id, plan_key, display_name, is_active, features, usage_limits)
values
  ('11111111-aaaa-4aaa-8aaa-111111111111', 'starter', 'Starter', true, '{"voice":true}'::jsonb, '{"orders_per_month":100}'::jsonb),
  ('22222222-bbbb-4bbb-8bbb-222222222222', 'internal-hidden', 'Hidden plan', false, '{}'::jsonb, '{}'::jsonb);

insert into public.billing_plan_prices(id, plan_id, currency, billing_interval, amount_minor, is_active)
values
  ('33333333-cccc-4ccc-8ccc-333333333333', '11111111-aaaa-4aaa-8aaa-111111111111', 'EGP', 'monthly', 149000, true),
  ('44444444-dddd-4ddd-8ddd-444444444444', '22222222-bbbb-4bbb-8bbb-222222222222', 'EGP', 'monthly', 0, true);

insert into public.billing_promotions(
  code, description, discount_type, percent_off, starts_at, ends_at, is_active
) values (
  'TEST50', 'CI-only test promotion', 'percent', 50,
  now() - interval '1 day', now() + interval '30 days', true
);

insert into public.merchant_subscriptions(
  id, owner_id, plan_id, price_id, status, billing_interval, currency
) values
  ('55555555-eeee-4eee-8eee-555555555555', '11111111-1111-4111-8111-111111111111',
   '11111111-aaaa-4aaa-8aaa-111111111111', '33333333-cccc-4ccc-8ccc-333333333333', 'trialing', 'monthly', 'EGP'),
  ('66666666-ffff-4fff-8fff-666666666666', '22222222-2222-4222-8222-222222222222',
   '11111111-aaaa-4aaa-8aaa-111111111111', '33333333-cccc-4ccc-8ccc-333333333333', 'active', 'monthly', 'EGP');

insert into public.billing_invoices(
  invoice_number, owner_id, subscription_id, status, currency,
  subtotal_minor, discount_minor, tax_minor, total_minor
) values (
  'TEST-INV-0001', '11111111-1111-4111-8111-111111111111',
  '55555555-eeee-4eee-8eee-555555555555', 'open', 'EGP', 149000, 74500, 0, 74500
);

insert into public.billing_payments(
  invoice_id, owner_id, provider, idempotency_key, status, amount_minor, currency
) values (
  (select id from public.billing_invoices where invoice_number = 'TEST-INV-0001'),
  '11111111-1111-4111-8111-111111111111', 'test-provider', 'test-payment-key-0001',
  'pending', 74500, 'EGP'
);

insert into public.billing_usage_records(
  owner_id, subscription_id, metric, quantity, unit, period_start, period_end, idempotency_key
) values (
  '11111111-1111-4111-8111-111111111111',
  '55555555-eeee-4eee-8eee-555555555555',
  'voice.minutes', 12.5, 'minutes', now() - interval '1 day', now() + interval '29 days',
  'test-usage-key-0001'
);

insert into public.billing_subscription_events(
  owner_id, subscription_id, event_type, actor_type, metadata
) values (
  '11111111-1111-4111-8111-111111111111',
  '55555555-eeee-4eee-8eee-555555555555',
  'trial.started', 'system', '{"source":"migration-test"}'::jsonb
);

do $$
begin
  if (select count(*) from public.billing_plans) <> 2
     or (select count(*) from public.billing_plan_prices) <> 2 then
    raise exception 'BILLING_TEST_PLAN_SEED_FAILED';
  end if;
  if has_table_privilege('anon', 'public.merchant_subscriptions', 'SELECT')
     or has_table_privilege('authenticated', 'public.merchant_subscriptions', 'INSERT')
     or has_table_privilege('authenticated', 'public.billing_payments', 'UPDATE')
     or has_table_privilege('anon', 'public.billing_promotions', 'SELECT') then
    raise exception 'BILLING_TEST_CLIENT_GRANTS_TOO_BROAD';
  end if;

  -- A payment cannot attach another merchant's invoice, even when written
  -- by trusted server code. Composite tenant foreign keys enforce this.
  begin
    insert into public.billing_payments(
      invoice_id, owner_id, provider, idempotency_key, status, amount_minor, currency
    ) values (
      (select id from public.billing_invoices where invoice_number = 'TEST-INV-0001'),
      '22222222-2222-4222-8222-222222222222', 'test-provider', 'cross-tenant-payment-0001',
      'pending', 74500, 'EGP'
    );
    raise exception 'BILLING_TEST_CROSS_TENANT_PAYMENT_ACCEPTED';
  exception when foreign_key_violation then
    null;
  end;
  begin
    update public.billing_subscription_events
       set event_type = 'tampered'
     where event_type = 'trial.started';
    raise exception 'BILLING_TEST_AUDIT_EVENT_MUTABLE';
  exception when raise_exception then
    if sqlerrm <> 'BILLING_EVENTS_ARE_APPEND_ONLY' then raise; end if;
  end;
end;
$$;

-- Trusted app_metadata admin claims can read platform-wide billing data.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin"}}', false);
do $admin_read_test$
declare v_count integer;
begin
  if not public.is_soovoice_platform_admin() then raise exception 'BILLING_TEST_ADMIN_CLAIM_NOT_RECOGNIZED'; end if;
  select count(*) into v_count from public.merchant_subscriptions;
  if v_count <> 2 then raise exception 'BILLING_TEST_ADMIN_SUBSCRIPTION_OVERVIEW_FAILED'; end if;
  select count(*) into v_count from public.billing_plans;
  if v_count <> 2 then raise exception 'BILLING_TEST_ADMIN_PLAN_CATALOG_FAILED'; end if;
  select count(*) into v_count from public.billing_invoices;
  if v_count <> 1 then raise exception 'BILLING_TEST_ADMIN_INVOICE_OVERVIEW_FAILED'; end if;
  select count(*) into v_count from public.billing_payments;
  if v_count <> 1 then raise exception 'BILLING_TEST_ADMIN_PAYMENT_OVERVIEW_FAILED'; end if;
  select count(*) into v_count from public.billing_usage_records;
  if v_count <> 1 then raise exception 'BILLING_TEST_ADMIN_USAGE_OVERVIEW_FAILED'; end if;
  select count(*) into v_count from public.billing_subscription_events;
  if v_count <> 1 then raise exception 'BILLING_TEST_ADMIN_EVENT_OVERVIEW_FAILED'; end if;
  select count(*) into v_count from public.billing_promotions;
  if v_count <> 1 then raise exception 'BILLING_TEST_ADMIN_PROMOTION_OVERVIEW_FAILED'; end if;
end;
$admin_read_test$;
reset role;

-- User-editable metadata is deliberately not an authorization source.
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
select set_config('request.jwt.claims', '{"user_metadata":{"role":"admin"}}', false);
do $user_metadata_test$
begin
  if public.is_soovoice_platform_admin() then raise exception 'BILLING_TEST_USER_METADATA_GRANTED_ADMIN'; end if;
end;
$user_metadata_test$;
reset role;

-- Authenticated merchants can read their own billing records, never another
-- merchant's rows, and cannot mutate billing state from the browser.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.merchant_subscriptions;
  if v_count <> 1 then raise exception 'BILLING_TEST_SUBSCRIPTION_TENANT_ISOLATION_FAILED'; end if;
  select count(*) into v_count from public.billing_invoices;
  if v_count <> 1 then raise exception 'BILLING_TEST_INVOICE_OWNER_READ_FAILED'; end if;
  select count(*) into v_count from public.billing_payments;
  if v_count <> 1 then raise exception 'BILLING_TEST_PAYMENT_OWNER_READ_FAILED'; end if;
  select count(*) into v_count from public.billing_usage_records;
  if v_count <> 1 then raise exception 'BILLING_TEST_USAGE_OWNER_READ_FAILED'; end if;
  select count(*) into v_count from public.billing_subscription_events;
  if v_count <> 1 then raise exception 'BILLING_TEST_EVENT_OWNER_READ_FAILED'; end if;
end;
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.merchant_subscriptions;
  if v_count <> 1 then raise exception 'BILLING_TEST_SECOND_TENANT_SUBSCRIPTION_READ_FAILED'; end if;
  select count(*) into v_count from public.billing_invoices;
  if v_count <> 0 then raise exception 'BILLING_TEST_CROSS_TENANT_INVOICE_LEAK'; end if;
end;
$$;
reset role;

set role anon;
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.billing_plans;
  if v_count <> 1 then raise exception 'BILLING_TEST_PUBLIC_PLAN_FILTER_FAILED'; end if;
  select count(*) into v_count from public.billing_plan_prices;
  if v_count <> 1 then raise exception 'BILLING_TEST_PUBLIC_PRICE_FILTER_FAILED'; end if;
end;
$$;
reset role;

select 'BILLING_FOUNDATION_TESTS_PASSED' as result;
