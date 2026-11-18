-- End-to-end database checks for trusted modifier selection and pricing.
begin;

insert into auth.users(id) values ('88888888-8888-4888-8888-888888888888')
on conflict do nothing;

insert into public.menu_items(id, "ownerId", name, description, price, "isAiOnly")
values ('modifier-checkout-burger', '88888888-8888-4888-8888-888888888888', 'Burger', 'Test item', 100, false)
on conflict (id) do update set price = excluded.price;

insert into public.menu_modifier_groups(
  id, owner_id, menu_item_id, name, is_required, min_select, max_select
) values (
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '88888888-8888-4888-8888-888888888888',
 'modifier-checkout-burger', 'Add-ons', true, 1, 2
) on conflict (id) do nothing;

insert into public.menu_modifier_options(id, owner_id, group_id, name, price_delta)
values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '88888888-8888-4888-8888-888888888888', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Cheese', 15),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '88888888-8888-4888-8888-888888888888', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Bacon', 20)
on conflict (id) do nothing;

set role service_role;
select set_config('request.jwt.claim.role', 'service_role', false);

do $$
declare
  v_result jsonb;
  v_replay jsonb;
  v_items jsonb;
begin
  v_result := public.create_guest_order(
    '88888888-8888-4888-8888-888888888888',
    'A1',
    '[{"id":"modifier-checkout-burger","quantity":2,"modifiers":[{"groupId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","optionIds":["dddddddd-dddd-4ddd-8ddd-dddddddddddd","eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"]}]}]'::jsonb,
    '',
    1,
    'modifier-checkout-valid-key-01',
    repeat('c', 64),
    repeat('d', 64)
  );

  if (v_result->>'total')::numeric <> 270 then
    raise exception 'MODIFIER_PRICE_NOT_CALCULATED_FROM_DATABASE: %', v_result;
  end if;
  v_items := v_result->'items';
  if (v_items #>> '{0,basePrice}')::numeric <> 100
     or (v_items #>> '{0,price}')::numeric <> 135
     or jsonb_array_length(v_items #> '{0,modifiers,0,options}') <> 2 then
    raise exception 'MODIFIER_SNAPSHOT_NOT_STORED: %', v_items;
  end if;

  v_replay := public.create_guest_order(
    '88888888-8888-4888-8888-888888888888',
    'A1',
    '[{"id":"modifier-checkout-burger","quantity":2,"modifiers":[{"groupId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","optionIds":["dddddddd-dddd-4ddd-8ddd-dddddddddddd","eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"]}]}]'::jsonb,
    '',
    1,
    'modifier-checkout-valid-key-01',
    repeat('c', 64),
    repeat('d', 64)
  );
  if v_replay->>'orderId' <> v_result->>'orderId' or v_replay->>'replayed' <> 'true' then
    raise exception 'MODIFIER_CHECKOUT_IDEMPOTENCY_FAILED';
  end if;

  begin
    perform public.create_guest_order(
      '88888888-8888-4888-8888-888888888888', 'A1',
      '[{"id":"modifier-checkout-burger","quantity":1,"modifiers":[]}]'::jsonb,
      '', 1, 'modifier-checkout-missing-key-1', repeat('e',64), repeat('f',64)
    );
    raise exception 'REQUIRED_MODIFIER_WAS_NOT_ENFORCED';
  exception when others then
    if sqlerrm = 'REQUIRED_MODIFIER_WAS_NOT_ENFORCED' then raise; end if;
    if sqlerrm not like '%INVALID_MODIFIER_SELECTION%' then raise; end if;
  end;

  begin
    perform public.create_guest_order(
      '88888888-8888-4888-8888-888888888888', 'A1',
      '[{"id":"modifier-checkout-burger","quantity":1,"modifiers":[{"groupId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","optionIds":["dddddddd-dddd-4ddd-8ddd-dddddddddddd","eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","dddddddd-dddd-4ddd-8ddd-dddddddddddd"]}]}]'::jsonb,
      '', 1, 'modifier-checkout-max-key-001', repeat('a',64), repeat('b',64)
    );
    raise exception 'MAX_MODIFIER_SELECTION_WAS_NOT_ENFORCED';
  exception when others then
    if sqlerrm = 'MAX_MODIFIER_SELECTION_WAS_NOT_ENFORCED' then raise; end if;
    if sqlerrm not like '%INVALID_MODIFIER_SELECTION%' and sqlerrm not like '%DUPLICATE_MODIFIER_OPTION%' then raise; end if;
  end;

  begin
    perform public.create_guest_order(
      '88888888-8888-4888-8888-888888888888', 'A1',
      '[{"id":"modifier-checkout-burger","quantity":1,"modifiers":[{"groupId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","optionIds":["ffffffff-ffff-4fff-8fff-ffffffffffff"]}]}]'::jsonb,
      '', 1, 'modifier-checkout-invalid-key-01', repeat('1',64), repeat('2',64)
    );
    raise exception 'UNAVAILABLE_MODIFIER_WAS_ACCEPTED';
  exception when others then
    if sqlerrm = 'UNAVAILABLE_MODIFIER_WAS_ACCEPTED' then raise; end if;
    if sqlerrm not like '%MODIFIER_UNAVAILABLE%' then raise; end if;
  end;
end;
$$;

reset role;

do $$
begin
  if not exists (
    select 1 from public.order_outbox
     where payload->'items' @> '[{"id":"modifier-checkout-burger","price":135}]'::jsonb
  ) then
    raise exception 'POS_OUTBOX_MISSING_MODIFIER_PRICE_SNAPSHOT';
  end if;
end;
$$;

rollback;

select 'GUEST_ORDER_MODIFIER_CHECKOUT_PASSED' as result;
