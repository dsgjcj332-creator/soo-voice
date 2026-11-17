-- Platform billing admin role, catalog writes and immutable audit tests.

-- Normal merchant session: public active plan read only, own subscription only.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","user_metadata":{"role":"admin"}}', false);
do $$
declare
  v_count integer;
begin
  if public.is_platform_admin() then raise exception 'BILLING_USER_METADATA_MUST_NOT_GRANT_ADMIN'; end if;
  select count(*) into v_count from public.billing_plans;
  if v_count <> 1 then raise exception 'BILLING_NORMAL_USER_PLAN_READ_FAILED'; end if;
  select count(*) into v_count from public.merchant_subscriptions;
  if v_count <> 1 then raise exception 'BILLING_NORMAL_USER_CROSSTENANT_READ'; end if;
  begin
    update public.billing_plans set is_active = false where plan_key = 'starter';
    raise exception 'BILLING_NORMAL_USER_UPDATED_PLAN';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

-- Platform admins are identified only from trusted app_metadata claims.
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"roles":["admin"]}}', false);
do $$
declare
  v_count integer;
begin
  if not public.is_platform_admin() then raise exception 'BILLING_APP_METADATA_ADMIN_NOT_RECOGNIZED'; end if;
  select count(*) into v_count from public.billing_plans;
  if v_count <> 2 then raise exception 'BILLING_ADMIN_CANNOT_READ_ALL_PLANS'; end if;
  select count(*) into v_count from public.merchant_subscriptions;
  if v_count <> 2 then raise exception 'BILLING_ADMIN_CANNOT_READ_ALL_SUBSCRIPTIONS'; end if;

  update public.billing_plans set display_name = 'Starter Updated'
   where plan_key = 'starter';
  if not exists (
    select 1 from public.billing_admin_audit_events
     where entity_type = 'billing_plans' and action = 'update'
       and entity_id = '11111111-aaaa-4aaa-8aaa-111111111111'
       and actor_id = '22222222-2222-4222-8222-222222222222'
  ) then
    raise exception 'BILLING_ADMIN_CATALOG_CHANGE_NOT_AUDITED';
  end if;

  begin
    update public.merchant_subscriptions set status = 'canceled'
     where owner_id = '11111111-1111-4111-8111-111111111111';
    raise exception 'BILLING_ADMIN_BROWSER_MUTATED_SUBSCRIPTION';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.billing_admin_audit_events set action = 'delete'
     where entity_type = 'billing_plans';
    raise exception 'BILLING_ADMIN_AUDIT_MUTABLE';
  exception when raise_exception then
    if sqlerrm <> 'BILLING_EVENTS_ARE_APPEND_ONLY' then raise; end if;
  end;
end;
$$;
reset role;

select 'BILLING_ADMIN_TESTS_PASSED' as result;
