-- Integration coverage for merchant-owned default and table-specific POS routes.
begin;

insert into auth.users(id) values
  ('f1111111-f111-4111-8111-111111111111'),
  ('f2222222-f222-4222-8222-222222222222')
on conflict do nothing;

insert into public.pos_connections(id, owner_id, provider, status, outbound_orders_enabled)
values
  ('faaaaaaa-faaa-4aaa-8aaa-aaaaaaaaaaaa','f1111111-f111-4111-8111-111111111111','custom','connected',true),
  ('fbbbbbbb-fbbb-4bbb-8bbb-bbbbbbbbbbbb','f1111111-f111-4111-8111-111111111111','custom','connected',true),
  ('fccccccc-fccc-4ccc-8ccc-cccccccccccc','f2222222-f222-4222-8222-222222222222','custom','connected',true),
  ('fddddddd-fddd-4ddd-8ddd-dddddddddddd','f1111111-f111-4111-8111-111111111111','custom','pending',false);

insert into public.pos_locations(id, owner_id, connection_id, provider_location_id, name, currency, active)
values
  ('faaa0001-faaa-4001-8001-faaaaaaaaaaa','f1111111-f111-4111-8111-111111111111','faaaaaaa-faaa-4aaa-8aaa-aaaaaaaaaaaa','north-branch','North','EGP',true),
  ('fbbb0001-fbbb-4001-8001-fbbbbbbbbbbb','f1111111-f111-4111-8111-111111111111','fbbbbbbb-fbbb-4bbb-8bbb-bbbbbbbbbbbb','south-branch','South','EGP',true),
  ('fccc0001-fccc-4001-8001-fccccccccccc','f2222222-f222-4222-8222-222222222222','fccccccc-fccc-4ccc-8ccc-cccccccccccc','other-branch','Other','EGP',true);

select set_config('request.jwt.claim.role','service_role',true);
select public.save_pos_order_route(
  'f1111111-f111-4111-8111-111111111111',
  'faaaaaaa-faaa-4aaa-8aaa-aaaaaaaaaaaa',
  'faaa0001-faaa-4001-8001-faaaaaaaaaaa',
  'default', null
);
select public.save_pos_order_route(
  'f1111111-f111-4111-8111-111111111111',
  'fbbbbbbb-fbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'fbbb0001-fbbb-4001-8001-fbbbbbbbbbbb',
  'table', 't12'
);

do $test$
begin
  if (select count(*) from public.pos_order_routes
      where owner_id='f1111111-f111-4111-8111-111111111111') <> 2 then
    raise exception 'EXPECTED_DEFAULT_AND_TABLE_ROUTE';
  end if;
  if not exists (select 1 from public.pos_order_routes
      where owner_id='f1111111-f111-4111-8111-111111111111'
        and route_type='table' and route_value='T12'
        and location_id='fbbb0001-fbbb-4001-8001-fbbbbbbbbbbb') then
    raise exception 'TABLE_ROUTE_NOT_NORMALIZED_OR_SAVED';
  end if;
end $test$;

-- Replacing the default is atomic and preserves table-specific rules.
select public.save_pos_order_route(
  'f1111111-f111-4111-8111-111111111111',
  'fbbbbbbb-fbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'fbbb0001-fbbb-4001-8001-fbbbbbbbbbbb',
  'default', null
);
do $test$
begin
  if (select count(*) from public.pos_order_routes
      where owner_id='f1111111-f111-4111-8111-111111111111' and route_type='default') <> 1 then
    raise exception 'DEFAULT_ROUTE_NOT_UNIQUE';
  end if;
  if (select location_id from public.pos_order_routes
      where owner_id='f1111111-f111-4111-8111-111111111111' and route_type='default')
      <> 'fbbb0001-fbbb-4001-8001-fbbbbbbbbbbb'::uuid then
    raise exception 'DEFAULT_ROUTE_NOT_REPLACED';
  end if;
  if (select count(*) from public.pos_order_routes
      where owner_id='f1111111-f111-4111-8111-111111111111' and route_type='table') <> 1 then
    raise exception 'TABLE_ROUTE_WAS_LOST';
  end if;
end $test$;

-- A different merchant cannot attach another tenant's connection or branch.
do $test$
begin
  begin
    perform public.save_pos_order_route(
      'f1111111-f111-4111-8111-111111111111',
      'fccccccc-fccc-4ccc-8ccc-cccccccccccc',
      'fccc0001-fccc-4001-8001-fccccccccccc',
      'table', 'T99'
    );
    raise exception 'CROSS_TENANT_ROUTE_WAS_ACCEPTED';
  exception when insufficient_privilege then
    if sqlerrm not like '%NOT_CONNECTED%' then raise; end if;
  end;
end $test$;

-- New connections start with neither direction enabled.
do $test$
begin
  if (select inbound_webhooks_enabled from public.pos_connections
      where id='fddddddd-fddd-4ddd-8ddd-dddddddddddd') is distinct from false
     or (select outbound_orders_enabled from public.pos_connections
      where id='fddddddd-fddd-4ddd-8ddd-dddddddddddd') is distinct from false then
    raise exception 'POS_CAPABILITY_FLAGS_MUST_DEFAULT_FALSE';
  end if;
end $test$;

-- Authenticated merchants can read only their own routing rows.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','f1111111-f111-4111-8111-111111111111',true);
do $test$
begin
  if (select count(*) from public.pos_order_routes) <> 2 then
    raise exception 'ROUTE_TENANT_READ_POLICY_FAILED';
  end if;
  begin
    insert into public.pos_order_routes(owner_id,connection_id,location_id,route_type)
    values ('f1111111-f111-4111-8111-111111111111',
      'faaaaaaa-faaa-4aaa-8aaa-aaaaaaaaaaaa',
      'faaa0001-faaa-4001-8001-faaaaaaaaaaa','default');
    raise exception 'BROWSER_ROUTE_WRITE_WAS_ALLOWED';
  exception when insufficient_privilege then
    null;
  end;
end $test$;
reset role;

-- Deactivating a branch clears all routes to it so new orders cannot remain
-- pinned to a branch that the merchant has explicitly disabled.
update public.pos_locations
set active = false
where id = 'fbbb0001-fbbb-4001-8001-fbbbbbbbbbbb';
do $test$
begin
  if exists (select 1 from public.pos_order_routes
      where owner_id='f1111111-f111-4111-8111-111111111111'
        and location_id='fbbb0001-fbbb-4001-8001-fbbbbbbbbbbb') then
    raise exception 'INACTIVE_BRANCH_ROUTE_WAS_NOT_CLEARED';
  end if;
end $test$;

rollback;
