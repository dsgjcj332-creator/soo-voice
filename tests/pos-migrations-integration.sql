-- Behavioral tests for the POS registry/catalog/mapping migrations.
-- Run only against the disposable PostgreSQL database created by CI bootstrap.

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

insert into public.pos_connections(id, owner_id, provider, status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'foodics', 'connected'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'toast', 'connected');

insert into public.pos_locations(id, owner_id, connection_id, provider_location_id, name)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'branch-1', 'Tenant One Branch'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'branch-2', 'Tenant Two Branch');

select set_config('request.jwt.claim.role', 'service_role', false);

do $$
declare
  v_name text;
  v_active boolean;
  v_event_count integer;
begin
  -- Initial snapshot inserts one catalog row.
  perform public.sync_pos_catalog_snapshot(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '[{"providerId":"burger-1","name":"Burger","currency":"EGP","unitPrice":"50.00","available":true,"modifierGroups":[],"updatedAt":"2026-11-17T10:00:00Z"}]'::jsonb,
    false
  );

  -- A stale provider timestamp must not overwrite newer catalog content.
  perform public.sync_pos_catalog_snapshot(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '[{"providerId":"burger-1","name":"Old Burger","currency":"EGP","unitPrice":"10.00","available":true,"modifierGroups":[],"updatedAt":"2026-11-16T10:00:00Z"}]'::jsonb,
    false
  );
  select name into v_name from public.pos_catalog_items where provider_item_id = 'burger-1';
  if v_name <> 'Burger' then
    raise exception 'POS_TEST_STALE_SNAPSHOT_OVERWROTE_NEWER_DATA';
  end if;

  -- An empty partial snapshot must not deactivate unseen products.
  perform public.sync_pos_catalog_snapshot(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '[]'::jsonb,
    false
  );
  select active into v_active from public.pos_catalog_items where provider_item_id = 'burger-1';
  if v_active is distinct from true then
    raise exception 'POS_TEST_PARTIAL_SNAPSHOT_DEACTIVATED_PRODUCT';
  end if;

  -- An explicitly complete empty snapshot deactivates the unseen product.
  perform public.sync_pos_catalog_snapshot(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '[]'::jsonb,
    true
  );
  select active into v_active from public.pos_catalog_items where provider_item_id = 'burger-1';
  if v_active is distinct from false then
    raise exception 'POS_TEST_COMPLETE_SNAPSHOT_DID_NOT_DEACTIVATE_PRODUCT';
  end if;

  -- A newer complete snapshot can reactivate and update the product.
  perform public.sync_pos_catalog_snapshot(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '[{"providerId":"burger-1","name":"Burger Deluxe","currency":"EGP","unitPrice":"65.00","available":true,"modifierGroups":[],"updatedAt":"2026-11-18T10:00:00Z"}]'::jsonb,
    true
  );
  -- A complete snapshot can deactivate the item when the provider omits it.
  perform public.sync_pos_catalog_snapshot(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '[]'::jsonb,
    true
  );
  -- A stale record in a later complete snapshot must not reactivate it.
  perform public.sync_pos_catalog_snapshot(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '[{"providerId":"burger-1","name":"Old Burger","currency":"EGP","unitPrice":"10.00","available":true,"modifierGroups":[],"updatedAt":"2026-11-16T10:00:00Z"}]'::jsonb,
    true
  );
  select active into v_active from public.pos_catalog_items where provider_item_id = 'burger-1';
  if v_active is distinct from false then
    raise exception 'POS_TEST_STALE_SNAPSHOT_REACTIVATED_DEACTIVATED_PRODUCT';
  end if;
  -- A genuinely newer snapshot is allowed to reactivate the product.
  perform public.sync_pos_catalog_snapshot(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '[{"providerId":"burger-1","name":"Burger Fresh","currency":"EGP","unitPrice":"70.00","available":true,"modifierGroups":[],"updatedAt":"2026-11-19T10:00:00Z"}]'::jsonb,
    true
  );
  select name, active into v_name, v_active
    from public.pos_catalog_items where provider_item_id = 'burger-1';
  if v_name <> 'Burger Fresh' or v_active is distinct from true then
    raise exception 'POS_TEST_NEWER_SNAPSHOT_FAILED_TO_REACTIVATE_PRODUCT';
  end if;

  -- Seed a second tenant's catalog row to prove RLS isolation below.
  perform public.sync_pos_catalog_snapshot(
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '[{"providerId":"tea-1","name":"Tea","currency":"EGP","unitPrice":"20.00","available":true,"modifierGroups":[],"updatedAt":"2026-11-17T10:00:00Z"}]'::jsonb,
    false
  );

  -- Only the service-role claim may execute the catalog RPC.
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.sync_pos_catalog_snapshot(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '[]'::jsonb,
      false
    );
    raise exception 'POS_TEST_AUTHENTICATED_RPC_CALL_WAS_NOT_REJECTED';
  exception when insufficient_privilege then
    null;
  end;
  perform set_config('request.jwt.claim.role', 'service_role', true);

  -- Mapping creation and protection changes each create audit events.
  insert into public.pos_catalog_menu_links(
    owner_id, connection_id, location_id, provider_item_id,
    menu_item_id, field_overrides, approved_by
  ) values (
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'burger-1', 'menu-burger-1', '{"price":true}'::jsonb,
    '11111111-1111-4111-8111-111111111111'
  );

  update public.pos_catalog_menu_links
     set field_overrides = '{"price":true,"name":true}'::jsonb
   where provider_item_id = 'burger-1';

  update public.pos_catalog_menu_links
     set menu_item_id = 'menu-burger-relinked'
   where provider_item_id = 'burger-1';

  update public.pos_catalog_menu_links
     set approved_at = now()
   where provider_item_id = 'burger-1';

  -- A mapping cannot point at a provider item absent from this branch catalog.
  begin
    insert into public.pos_catalog_menu_links(
      owner_id, connection_id, location_id, provider_item_id,
      menu_item_id, approved_by
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'missing-provider-item', 'menu-missing', 
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'POS_TEST_MAPPING_ACCEPTED_UNKNOWN_CATALOG_ITEM';
  exception when foreign_key_violation then
    null;
  end;

  if has_table_privilege('service_role', 'public.pos_catalog_menu_link_events', 'UPDATE')
     or has_table_privilege('service_role', 'public.pos_catalog_menu_link_events', 'DELETE') then
    raise exception 'POS_TEST_SERVICE_ROLE_CAN_MUTATE_AUDIT_HISTORY';
  end if;

  select count(*) into v_event_count
    from public.pos_catalog_menu_link_events
   where owner_id = '11111111-1111-4111-8111-111111111111';
  if v_event_count <> 4 then
    raise exception 'POS_TEST_MAPPING_AUDIT_EVENTS_MISSING';
  end if;
  if (select count(*) from public.pos_catalog_menu_link_events where event_type = 'created') <> 1
     or (select count(*) from public.pos_catalog_menu_link_events where event_type = 'protection_updated') <> 1
     or (select count(*) from public.pos_catalog_menu_link_events where event_type = 'relinked') <> 1
     or (select count(*) from public.pos_catalog_menu_link_events where event_type = 'reapproved') <> 1 then
    raise exception 'POS_TEST_MAPPING_AUDIT_EVENT_TYPES_MISSING';
  end if;
end;
$$;

-- Exercise the transactional merchant-approved menu apply RPC, not only its DDL.
insert into public.menu_items(id, "ownerId", name, description, price, "isAiOnly")
values ('menu-burger-relinked', '11111111-1111-4111-8111-111111111111',
        'Local Burger', 'Local description', 60.00, false);

-- Remove the merchant field protections for this explicit apply test.
update public.pos_catalog_menu_links
   set field_overrides = '{}'::jsonb
 where owner_id = '11111111-1111-4111-8111-111111111111'
   and location_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
   and provider_item_id = 'burger-1'
   and menu_item_id = 'menu-burger-relinked';

do $$
declare
  v_result jsonb;
  v_replay jsonb;
  v_name text;
  v_price numeric;
  v_event_count integer;
begin
  v_result := public.apply_pos_catalog_menu_fields(
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'burger-1', 'menu-burger-relinked',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    array['name','price'],
    '{"name":"Local Burger","price":60.00}'::jsonb,
    '{"name":"Burger Fresh","price":70.00}'::jsonb
  );
  if v_result->>'applied' <> 'true' or v_result->>'replayed' <> 'false'
     or v_result->'before' <> '{"name":"Local Burger","price":60.00}'::jsonb
     or v_result->'after' <> '{"name":"Burger Fresh","price":70.00}'::jsonb then
    raise exception 'POS_TEST_MENU_APPLY_RESULT_INVALID';
  end if;

  select name, price into v_name, v_price from public.menu_items
   where id = 'menu-burger-relinked';
  if v_name <> 'Burger Fresh' or v_price <> 70.00 then
    raise exception 'POS_TEST_MENU_APPLY_DID_NOT_UPDATE_SELECTED_FIELDS';
  end if;

  select count(*) into v_event_count from public.pos_catalog_menu_apply_events
   where owner_id = '11111111-1111-4111-8111-111111111111';
  if v_event_count <> 1 then
    raise exception 'POS_TEST_MENU_APPLY_AUDIT_EVENT_MISSING';
  end if;

  -- An identical request is replayed without a second write or audit event.
  v_replay := public.apply_pos_catalog_menu_fields(
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'burger-1', 'menu-burger-relinked',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    array['name','price'],
    '{"name":"Local Burger","price":60.00}'::jsonb,
    '{"name":"Burger Fresh","price":70.00}'::jsonb
  );
  if v_replay->>'replayed' <> 'true' or v_replay->>'eventId' <> v_result->>'eventId' then
    raise exception 'POS_TEST_MENU_APPLY_IDEMPOTENT_REPLAY_FAILED';
  end if;

  -- Reusing the idempotency key with a different payload must fail closed.
  begin
    perform public.apply_pos_catalog_menu_fields(
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'burger-1', 'menu-burger-relinked',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      array['name'],
      '{"name":"Local Burger"}'::jsonb,
      '{"name":"Tampered"}'::jsonb
    );
    raise exception 'POS_TEST_MENU_APPLY_IDEMPOTENCY_CONFLICT_NOT_REJECTED';
  exception when unique_violation then
    null;
  end;

  -- Optimistic concurrency must reject stale before-values.
  begin
    perform public.apply_pos_catalog_menu_fields(
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'burger-1', 'menu-burger-relinked',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      array['name'],
      '{"name":"Local Burger"}'::jsonb,
      '{"name":"Should not apply"}'::jsonb
    );
    raise exception 'POS_TEST_MENU_APPLY_STALE_VALUE_NOT_REJECTED';
  exception when serialization_failure then
    null;
  end;

  -- A merchant-protected field cannot be changed even by this service RPC.
  update public.pos_catalog_menu_links set field_overrides = '{"name":true}'::jsonb
   where owner_id = '11111111-1111-4111-8111-111111111111'
     and location_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
     and provider_item_id = 'burger-1'
     and menu_item_id = 'menu-burger-relinked';
  begin
    perform public.apply_pos_catalog_menu_fields(
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'burger-1', 'menu-burger-relinked',
      '99999999-9999-4999-8999-999999999999',
      array['name'],
      '{"name":"Burger Fresh"}'::jsonb,
      '{"name":"Protected overwrite"}'::jsonb
    );
    raise exception 'POS_TEST_MENU_APPLY_PROTECTED_FIELD_NOT_REJECTED';
  exception when insufficient_privilege then
    null;
  end;

  -- Authenticated clients cannot execute the service-role-only RPC.
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.apply_pos_catalog_menu_fields(
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'burger-1', 'menu-burger-relinked',
      '88888888-8888-4888-8888-888888888888',
      array['name'],
      '{"name":"Burger Fresh"}'::jsonb,
      '{"name":"Client overwrite"}'::jsonb
    );
    raise exception 'POS_TEST_AUTHENTICATED_MENU_APPLY_WAS_NOT_REJECTED';
  exception when insufficient_privilege then
    null;
  end;
  perform set_config('request.jwt.claim.role', 'service_role', true);

  if has_table_privilege('service_role', 'public.pos_catalog_menu_apply_events', 'INSERT')
     or has_table_privilege('service_role', 'public.pos_catalog_menu_apply_events', 'UPDATE')
     or has_table_privilege('service_role', 'public.pos_catalog_menu_apply_events', 'DELETE')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_apply_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_apply_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.pos_catalog_menu_apply_events', 'DELETE') then
    raise exception 'POS_TEST_MENU_APPLY_AUDIT_TABLE_WRITABLE_OUTSIDE_RPC';
  end if;
end;
$$;

-- Authenticated merchant can read only their own catalog and mapping history.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
do $$
begin
  if (select count(*) from public.pos_catalog_items) <> 1 then
    raise exception 'POS_TEST_CATALOG_RLS_TENANT_ISOLATION_FAILED';
  end if;
  if (select count(*) from public.pos_catalog_menu_link_events) < 4 then
    raise exception 'POS_TEST_AUDIT_RLS_TENANT_ISOLATION_FAILED';
  end if;
  raise notice 'POS_APPLY_RLS_DEBUG uid=%, visible=%', auth.uid(), (select count(*) from public.pos_catalog_menu_apply_events);
  if (select count(*) from public.pos_catalog_menu_apply_events) <> 1 then
    raise exception 'POS_TEST_MENU_APPLY_AUDIT_RLS_TENANT_ISOLATION_FAILED';
  end if;
end;
$$;
reset role;

-- A different authenticated tenant cannot read the first tenant's apply history.
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
set role authenticated;
do $$
begin
  if (select count(*) from public.pos_catalog_menu_apply_events) <> 0 then
    raise exception 'POS_TEST_MENU_APPLY_AUDIT_CROSSTENANT_READ';
  end if;
end;
$;
reset role;

-- Anonymous sessions must not be able to read catalog snapshots.
set role anon;
do $$
begin
  begin
    perform count(*) from public.pos_catalog_items;
    raise exception 'POS_TEST_ANON_CATALOG_READ_WAS_NOT_REJECTED';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

select 'POS_POSTGRES_INTEGRATION_TESTS_PASSED' as result;
