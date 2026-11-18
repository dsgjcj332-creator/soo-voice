-- Run after the billing foundation and platform admin audit migrations.
select set_config('request.jwt.claim.role', 'service_role', false);
insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','audit-admin@soovoice.test','',now(),'{"role":"admin"}','{}',now(),now())
on conflict (id) do nothing;
insert into public.platform_admin_audit_events(actor_id, action, resource_type, resource_id, after_state)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','billing.plan.created','billing_plan','ci-plan-1','{"plan_key":"ci-plan"}');
do $$
begin
  if (select count(*) from public.platform_admin_audit_events where action = 'billing.plan.created') <> 1 then
    raise exception 'PLATFORM_ADMIN_AUDIT_INSERT_FAILED';
  end if;
  begin
    update public.platform_admin_audit_events set action = 'tampered' where action = 'billing.plan.created';
    raise exception 'PLATFORM_ADMIN_AUDIT_MUTATION_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> 'PLATFORM_ADMIN_AUDIT_IS_APPEND_ONLY' then raise; end if;
  end;
  begin
    delete from public.platform_admin_audit_events where action = 'billing.plan.created';
    raise exception 'PLATFORM_ADMIN_AUDIT_DELETE_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> 'PLATFORM_ADMIN_AUDIT_IS_APPEND_ONLY' then raise; end if;
  end;
  if has_table_privilege('authenticated','public.platform_admin_audit_events','INSERT')
     or has_table_privilege('authenticated','public.platform_admin_audit_events','UPDATE')
     or has_table_privilege('anon','public.platform_admin_audit_events','SELECT') then
    raise exception 'PLATFORM_ADMIN_AUDIT_CLIENT_GRANTS_TOO_BROAD';
  end if;
end;
$$;
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',false);
do $$
begin
  if (select count(*) from public.platform_admin_audit_events) <> 1 then
    raise exception 'PLATFORM_ADMIN_AUDIT_ADMIN_READ_FAILED';
  end if;
end;
$$;
reset role;
select 'PLATFORM_ADMIN_AUDIT_TESTS_PASSED' as result;
