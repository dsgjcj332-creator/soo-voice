-- POS dispatch alerts: service-role writes, owner-scoped reads, no client writes.
insert into auth.users(id) values
 ('77777777-7777-4777-8777-777777777777'),
 ('88888888-8888-4888-8888-888888888888')
on conflict do nothing;
set role service_role;
insert into public.pos_dispatch_alerts(owner_id, order_id, event_id, error_code, attempts)
values
 ('77777777-7777-4777-8777-777777777777', 'order-owner-a-1', '99999999-1111-4111-8111-111111111111', 'POS_PROVIDER_TIMEOUT', 3),
 ('77777777-7777-4777-8777-777777777777', 'order-owner-a-2', '99999999-2222-4222-8222-222222222222', 'POS_CONNECTION_NOT_CONNECTED', 3),
 ('88888888-8888-4888-8888-888888888888', 'order-owner-b-1', '99999999-3333-4333-8333-333333333333', 'POS_PROVIDER_TIMEOUT', 4);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', false);
do $$
declare v_count integer; v_insert_blocked boolean := false; v_update_blocked boolean := false;
begin
 select count(*) into v_count from public.pos_dispatch_alerts where owner_id = auth.uid()::text;
 if v_count <> 2 then raise exception 'POS_DISPATCH_ALERTS_OWNER_READ_FAILED'; end if;
 select count(*) into v_count from public.pos_dispatch_alerts;
 if v_count <> 2 then raise exception 'POS_DISPATCH_ALERTS_TENANT_LEAK'; end if;
 begin
  insert into public.pos_dispatch_alerts(owner_id, order_id, event_id)
  values (auth.uid()::text, 'order-owner-a-3', '99999999-4444-4444-8444-444444444444');
 exception when insufficient_privilege then v_insert_blocked := true;
 end;
 if not v_insert_blocked then raise exception 'POS_DISPATCH_ALERTS_MERCHANT_INSERT_ALLOWED'; end if;
 begin
  update public.pos_dispatch_alerts set attempts = 99 where owner_id = auth.uid()::text;
 exception when insufficient_privilege then v_update_blocked := true;
 end;
 if not v_update_blocked then raise exception 'POS_DISPATCH_ALERTS_MERCHANT_UPDATE_ALLOWED'; end if;
end;
$$;
reset role;
-- Anonymous access is denied at the SQL privilege layer; assert this as
-- the migration owner rather than issuing a query that is expected to error.
do $$
begin
 if has_table_privilege('anon', 'public.pos_dispatch_alerts', 'SELECT')
    or has_table_privilege('anon', 'public.pos_dispatch_alerts', 'INSERT') then
   raise exception 'POS_DISPATCH_ALERTS_ANON_GRANTS_INVALID';
 end if;
 if not has_table_privilege('authenticated', 'public.pos_dispatch_alerts', 'SELECT')
    or has_table_privilege('authenticated', 'public.pos_dispatch_alerts', 'INSERT')
    or has_table_privilege('authenticated', 'public.pos_dispatch_alerts', 'UPDATE')
    or has_table_privilege('authenticated', 'public.pos_dispatch_alerts', 'DELETE') then
   raise exception 'POS_DISPATCH_ALERTS_AUTHENTICATED_GRANTS_INVALID';
 end if;
end;
$$;
select 'POS_DISPATCH_ALERTS_MIGRATION_TESTS_PASSED' as result;
