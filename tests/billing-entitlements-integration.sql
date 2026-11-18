-- Integration coverage for caller-scoped subscription entitlements.
insert into auth.users(id) values
 ('55555555-5555-4555-8555-555555555555'),
 ('66666666-6666-4666-8666-666666666666')
on conflict do nothing;

insert into public.billing_plans(id, plan_key, display_name, features, usage_limits, is_active)
values ('55555555-aaaa-4555-8555-555555555555', 'entitlement_test', 'Entitlement Test',
        '{"voice":true,"pos":false}'::jsonb, '{"voice_minutes":100}'::jsonb, true)
on conflict (id) do nothing;

insert into public.merchant_subscriptions(
  id, owner_id, plan_id, status, trial_starts_at, trial_ends_at, created_at
) values (
 '55555555-bbbb-4555-8555-555555555555',
 '55555555-5555-4555-8555-555555555555',
 '55555555-aaaa-4555-8555-555555555555',
 'trialing', now() - interval '1 day', now() + interval '5 days', now()
), (
 '66666666-bbbb-4666-8666-666666666666',
 '66666666-6666-4666-8666-666666666666',
 '55555555-aaaa-4555-8555-555555555555',
 'trialing', now() - interval '1 day', now() - interval '1 hour', now()
)
on conflict (id) do nothing;

insert into public.billing_usage_records(
 owner_id, subscription_id, metric, quantity, unit, period_start, period_end, idempotency_key
) values (
 '55555555-5555-4555-8555-555555555555',
 '55555555-bbbb-4555-8555-555555555555',
 'voice_minutes', 12.5, 'minutes',
 now() - interval '1 day', now() + interval '5 days',
 'entitlement-test-usage-01'
)
on conflict (owner_id, metric, idempotency_key) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', false);
do $$
declare
  v_result jsonb;
begin
  v_result := public.get_my_billing_entitlements();
  if v_result->>'access' <> 'true' then
    raise exception 'ACTIVE_TRIAL_ACCESS_NOT_GRANTED: %', v_result;
  end if;
  if v_result #>> '{plan,key}' <> 'entitlement_test'
     or v_result #>> '{plan,features,voice}' <> 'true'
     or v_result #>> '{plan,usage_limits,voice_minutes}' <> '100' then
    raise exception 'PLAN_ENTITLEMENTS_MISSING: %', v_result;
  end if;
  if v_result #>> '{usage,voice_minutes}' <> '12.500000' then
    raise exception 'USAGE_TOTAL_MISSING: %', v_result;
  end if;
end;
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', false);
do $$
declare v_result jsonb;
begin
  v_result := public.get_my_billing_entitlements();
  if v_result->>'access' <> 'false' or v_result->>'reason' <> 'trial_expired' then
    raise exception 'EXPIRED_TRIAL_ACCESS_MUST_BE_DENIED: %', v_result;
  end if;
  if v_result #>> '{plan,key}' <> 'entitlement_test' then
    raise exception 'EXPIRED_SUBSCRIPTION_PLAN_CONTEXT_MISSING: %', v_result;
  end if;
end;
$$;
reset role;

do $$
begin
  if has_function_privilege('anon', 'public.get_my_billing_entitlements()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_billing_entitlements()', 'EXECUTE') then
    raise exception 'ENTITLEMENT_FUNCTION_GRANTS_INVALID';
  end if;
end;
$$;

select 'BILLING_ENTITLEMENT_TESTS_PASSED' as result;
