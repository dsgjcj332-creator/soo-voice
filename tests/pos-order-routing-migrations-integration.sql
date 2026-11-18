-- Integration coverage for merchant-owned default and table-specific POS routes.
begin;

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222')
on conflict do nothing;

insert into public.pos_connections(id, owner_id, provider, status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','custom','connected'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','custom','connected'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','custom','connected');

insert into public.pos_locations(id, owner_id, connection_id, provider_location_id, name, currency, active)
values
  ('aaaa0001-aaaa-4001-8001-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','north-branch','North','EGP',true),
  ('bbbb0001-bbbb-4001-8001-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','south-branch','South','EGP',true),
  ('cccc0001-cccc-4001-8001-cccccccccccc','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','other-branch','Other','EGP',true);

select set_config('request.jwt.claim.role','service_role',true);
select public.save_pos_order_route(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaa0001-aaaa-4001-8001-aaaaaaaaaaaa',
  'default', null
);
select public.save_pos_order_route(
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbb0001-bbbb-4001-8001-bbbbbbbbbbbb',
  'table', 't12'
);

do $$
begin
  if (select count(*) from public.pos_order_routes
      where owner_id='11111111-1111-4111-8111-111111111111') <> 2 then
    raise exception 'EXPECTED_DEFAULT_AND_TABLE_ROUTE';
  end if;
  if not exists (select 1 from public.pos_order_routes
      where owner_id='11111111-1111-4111-8111-111111111111'
        and route_type='table' and route_value='T12'
        and location_id='bbbb0001-bbbb-4001-8001-bbbbbbbbbbbb') then
    raise exception 'TABLE_ROUTE_NOT_NORMALIZED_OR_SAVED';
  end if;
end $$;

-- Replacing the default is atomic and preserves table-specific rules.
select public.save_pos_order_route(
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbb0001-bbbb-4001-8001-bbbbbbbbbbbb',
  'default', null
);
do $$
begin
  if (select count(*) from public.pos_order_routes
      where owner_id='11111111-1111-4111-8111-111111111111' and route_type='default') <> 1 then
    raise exception 'DEFAULT_ROUTE_NOT_UNIQUE';
  end if;
  if (select location_id from public.pos_order_routes
      where owner_id='11111111-1111-4111-8111-111111111111' and route_type='default')
      <> 'bbbb0001-bbbb-4001-8001-bbbbbbbbbbbb'::uuid then
    raise exception 'DEFAULT_ROUTE_NOT_REPLACED';
  end if;
  if (select count(*) from public.pos_order_routes
      where owner_id='11111111-1111-4111-8111-111111111111' and route_type='table') <> 1 then
    raise exception 'TABLE_ROUTE_WAS_LOST';
  end if;
end $$;

-- A different merchant cannot attach another tenant's connection or branch.
do $$
begin
  begin
    perform public.save_pos_order_route(
      '11111111-1111-4111-8111-111111111111',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'cccc0001-cccc-4001-8001-cccccccccccc',
      'table', 'T99'
    );
    raise exception 'CROSS_TENANT_ROUTE_WAS_ACCEPTED';
  exception when insufficient_privilege then
    if sqlerrm not like '%NOT_CONNECTED%' then raise; end if;
  end;
end $$;

-- Authenticated merchants can read only their own routing rows.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
begin
  if (select count(*) from public.pos_order_routes) <> 2 then
    raise exception 'ROUTE_TENANT_READ_POLICY_FAILED';
  end if;
  begin
    insert into public.pos_order_routes(owner_id,connection_id,location_id,route_type)
    values ('11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaa0001-aaaa-4001-8001-aaaaaaaaaaaa','default');
    raise exception 'BROWSER_ROUTE_WRITE_WAS_ALLOWED';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

-- Deactivating a branch clears all routes to it so new orders cannot remain
-- pinned to a branch that the merchant has explicitly disabled.
update public.pos_locations
set active = false
where id = 'bbbb0001-bbbb-4001-8001-bbbbbbbbbbbb';
do $
begin
  if exists (select 1 from public.pos_order_routes
      where owner_id='11111111-1111-4111-8111-111111111111'
        and location_id='bbbb0001-bbbb-4001-8001-bbbbbbbbbbbb') then
    raise exception 'INACTIVE_BRANCH_ROUTE_WAS_NOT_CLEARED';
  end if;
end $;

rollback;
